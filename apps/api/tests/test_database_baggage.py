import asyncio

import pytest
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models.baggage import Baggage, BaggageEvent, Tag


async def test_list_and_detail_return_all_seeded_bags_not_spare_tags(client, seed_engine):
    with Session(seed_engine) as session, session.begin():
        tag = session.scalar(select(Tag).where(Tag.tag_code == "SEED-20261114-00"))
        tag.weight_kg = 0
    response = await client.get("/api/v1/baggage")
    assert response.status_code == 200, response.text
    bags = response.json()
    assert len(bags) == 10
    assert {bag["tag_code"] for bag in bags} == {
        f"SEED-20261114-{i:02}" for i in range(10)
    }
    assert not {"bag_01", "bag_03"} & {bag["id"] for bag in bags}
    for bag in bags:
        assert bag["events"]
        assert bag["last_known_location"] == bag["events"][-1]["location_code"]
        assert bag["risk_score"] is None
        assert bag["carousel_assigned"] is None
        for identifier in (bag["id"], bag["tag_number"], bag["tag_code"]):
            detail = await client.get(f"/api/v1/baggage/{identifier}")
            assert detail.status_code == 200, detail.text
            assert detail.json() == bag
    assert next(bag for bag in bags if bag["tag_code"].endswith("-00"))["weight_kg"] == 0


async def test_scan_and_nfc_tap_persist_matching_status_and_history(client, seed_engine):
    identifier = "SEED-20261114-00"
    scanned = await client.post(
        f"/api/v1/baggage/{identifier}/scan",
        json={"event_type": "MISROUTED", "location_code": "HKG-BAY-2", "staff_id": "STAFF-1"},
    )
    assert scanned.status_code == 200, scanned.text
    body = scanned.json()
    assert body["status"] == "MISROUTED" and body["is_rush_bag"] is True
    assert body["events"][-1]["handled_by_staff_id"] == "STAFF-1"
    assert body["last_known_location"] == "HKG-BAY-2"
    assert (await client.get(f"/api/v1/baggage/{identifier}")).json() == body
    tapped = await client.post(
        f"/api/v1/tags/{identifier}/tap",
        json={"next_status": "LOADED", "reader_id": "NFC-1", "location_code": "HKG-GATE"},
    )
    assert tapped.status_code == 200, tapped.text
    detail = (await client.get(f"/api/v1/baggage/{identifier}")).json()
    assert detail["status"] == tapped.json()["display"]["status"] == "LOADED"
    assert detail["events"][-1]["event_type"] == "LOADED"
    with Session(seed_engine) as session:
        tag = session.scalar(select(Tag).where(Tag.tag_code == identifier))
        bag = session.scalar(select(Baggage).where(Baggage.tag_id == tag.id))
        assert bag.status == tag.tag_status == "LOADED"


@pytest.mark.parametrize("choice", ["EXPRESS_NEXT_FLIGHT", "DIRECT_HOTEL_DELIVERY"])
async def test_risk_and_recovery_updates_survive_new_requests(client, choice):
    identifier = "SEED-20261114-00"
    risk = await client.post(
        f"/api/v1/baggage/{identifier}/risk/apply",
        json={"flight_number": "CX548", "origin": "HKG", "destination": "NRT",
              "transfer_minutes": 35},
    )
    assert risk.status_code == 200, risk.text
    response = await client.post(
        f"/api/v1/baggage/{identifier}/passenger/choice",
        json={"choice": choice, "hotel_address": "Synthetic Demo Hotel"},
    )
    assert response.status_code == 200, response.text
    detail = (await client.get(f"/api/v1/baggage/{identifier}")).json()
    assert detail == response.json()
    assert detail["risk_score"] == risk.json()["risk_score"]
    assert detail["model_version"] == risk.json()["model_version"]
    assert detail["connection_minutes"] == 35
    assert detail["status"] == "RECOVERY_IN_PROGRESS"
    assert detail["passenger_recovery_choice"] == choice
    assert detail["recovery_flight_number"]
    assert detail["delivery_address"] == (
        "Synthetic Demo Hotel" if choice == "DIRECT_HOTEL_DELIVERY" else None
    )
    assert detail["events"][-1]["event_type"] == "RECOVERY_IN_PROGRESS"


async def test_sync_uses_booked_itinerary_and_is_idempotent(client, seed_engine):
    identifier = "SEED-20261114-00"
    original = (await client.get(f"/api/v1/baggage/{identifier}")).json()
    for _ in range(2):
        response = await client.post(
            "/api/v1/baggage/sync",
            json={"tag_code": identifier, "initial_status": "SYNCHRONIZED", "weight_kg": 0},
        )
        assert response.status_code == 200, response.text
        assert response.json()["id"] == original["id"]
        assert response.json()["flight_number"] == original["flight_number"]
        assert response.json()["passenger_name"] == original["passenger_name"]
        assert response.json()["is_tag_synced"] is True
    with Session(seed_engine) as session:
        assert session.scalar(select(func.count()).select_from(Baggage)) == 10
    detail = (await client.get(f"/api/v1/baggage/{identifier}")).json()
    assert detail["weight_kg"] == 0
    assert detail["events"][-1]["event_type"] == "SYNCHRONIZED"
    assert detail["risk_score"] is not None


async def test_empty_table_and_unlinked_tags_do_not_restore_demo_bags(client, seed_engine):
    with Session(seed_engine) as session, session.begin():
        session.execute(delete(Baggage))
    assert (await client.get("/api/v1/baggage")).json() == []
    missing = await client.get("/api/v1/baggage/0160892012")
    assert missing.status_code == 404
    rejected = await client.post(
        "/api/v1/baggage/sync", json={"tag_code": "SEED-20261114-10"}
    )
    assert rejected.status_code == 409
    assert (await client.get("/api/v1/baggage")).json() == []


async def test_invalid_actions_and_reset_do_not_write(client, seed_engine):
    identifier = "SEED-20261114-00"
    original = (await client.get(f"/api/v1/baggage/{identifier}")).json()
    invalid = await client.post(
        f"/api/v1/baggage/{identifier}/scan", json={"event_type": "TELEPORTED"}
    )
    assert invalid.status_code == 422
    assert (await client.get(f"/api/v1/baggage/{identifier}")).json() == original
    assert (await client.post("/api/v1/baggage/reset")).status_code == 409
    missing = await client.post(
        "/api/v1/baggage/UNKNOWN/scan", json={"event_type": "LOADED"}
    )
    assert missing.status_code == 404
    with Session(seed_engine) as session:
        assert session.scalar(select(func.count()).select_from(Baggage)) == 10
        assert session.scalar(select(func.count()).select_from(BaggageEvent)) == 50


async def test_concurrent_sync_creates_only_one_baggage_row(client, seed_engine):
    identifier = "SEED-20261114-00"
    with Session(seed_engine) as session, session.begin():
        tag = session.scalar(select(Tag).where(Tag.tag_code == identifier))
        session.execute(delete(Baggage).where(Baggage.tag_id == tag.id))
    responses = await asyncio.gather(*[
        client.post(
            "/api/v1/baggage/sync",
            json={"tag_code": identifier, "initial_status": "SYNCHRONIZED"},
        )
        for _ in range(2)
    ])
    assert all(response.status_code == 200 for response in responses)
    assert responses[0].json()["id"] == responses[1].json()["id"]
    with Session(seed_engine) as session:
        assert session.scalar(select(func.count()).select_from(Baggage)) == 10


async def test_unattached_baggage_is_listed_without_inventing_tag_data(client, seed_engine):
    with Session(seed_engine) as session, session.begin():
        bag = session.scalar(select(Baggage).limit(1))
        bag.tag_id = None
        bag_id = str(bag.id)
    response = await client.get("/api/v1/baggage")
    assert len(response.json()) == 10
    orphan = next(bag for bag in response.json() if bag["id"] == bag_id)
    assert orphan["tag_number"] == bag_id
    assert orphan["tag_code"] is None and orphan["weight_kg"] is None
    assert orphan["events"] == []
    assert (await client.get(f"/api/v1/baggage/{bag_id}")).json() == orphan
    scan = await client.post(
        f"/api/v1/baggage/{bag_id}/scan", json={"event_type": "LOADED"}
    )
    assert scan.status_code == 409
