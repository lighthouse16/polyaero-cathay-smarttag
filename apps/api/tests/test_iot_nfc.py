import json
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, select

from app.core.database import async_session_maker
from app.main import app
from app.models.baggage import BaggageEvent, Tag
from app.models.flight import Flight


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


async def member_headers(client: AsyncClient, monkeypatch) -> dict[str, str]:
    sent: list[str] = []

    async def fake_send(channel: str, destination: str, code: str) -> None:
        sent.append(code)

    monkeypatch.setattr("app.api.v1.endpoints.auth.send_verification_code", fake_send)
    email = f"iot-{uuid4().hex[:8]}@example.com"
    initiated = await client.post("/api/v1/auth/signup/initiate", json={"email": email})
    signup_id = initiated.json()["signup_id"]
    verified = await client.post(
        "/api/v1/auth/signup/verify",
        json={
            "signup_id": signup_id,
            "code": sent[-1],
            "password": "Passw0rd!",
            "family_name": "CHAN",
            "given_names": "TAI MAN",
        },
    )
    assert verified.status_code == 200, verified.text
    return {"Authorization": f"Bearer {verified.json()['access_token']}"}


async def seeded_flight() -> Flight:
    async with async_session_maker() as session:
        flight = await session.scalar(
            select(Flight).where(Flight.flight_number == "CX548")
        )
    assert flight is not None
    return flight


async def make_tag() -> tuple[UUID, str]:
    code = f"04:{uuid4().hex[:12].upper()}"
    async with async_session_maker() as session:
        tag = Tag(tag_code=code)
        session.add(tag)
        await session.commit()
        await session.refresh(tag)
        return tag.id, tag.tag_code


async def create_booking(client: AsyncClient, headers: dict[str, str], flight_id: UUID) -> dict:
    response = await client.post(
        "/api/v1/bookings",
        json={"pnr": uuid4().hex[:6].upper(), "flight_id": str(flight_id)},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


async def synced_booking(
    client: AsyncClient, headers: dict[str, str]
) -> tuple[dict, UUID, str, dict]:
    flight = await seeded_flight()
    booking = await create_booking(client, headers, flight.id)
    tag_id, tag_code = await make_tag()
    linked = await client.post(
        "/api/v1/bookings/link-tag",
        json={"pnr": booking["pnr"], "tag_id": str(tag_id)},
        headers=headers,
    )
    assert linked.status_code == 200, linked.text
    synced = await client.post(
        "/api/v1/smarttag/sync/payload",
        json={"booking_id": booking["id"]},
        headers=headers,
    )
    assert synced.status_code == 200, synced.text
    return booking, tag_id, tag_code, synced.json()


async def test_display_reflects_app_sync(client: AsyncClient, monkeypatch):
    headers = await member_headers(client, monkeypatch)
    _, _, tag_code, synced = await synced_booking(client, headers)

    response = await client.get(f"/api/v1/tags/{tag_code}/display")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["flight"] == "CX548"
    assert body["origin"] == "HKG"
    assert body["destination"] == "NRT"
    assert body["sync_state"] == "READY"
    assert body["barcode"] == synced["bar_code_payload"]
    assert body["bag_number"] == synced["bar_code_payload"]
    assert body["status"] == "CHECKED_IN"
    assert body["banner"] == "CHECKED IN"


async def test_tap_with_ndef_updates_progress(client: AsyncClient, monkeypatch):
    headers = await member_headers(client, monkeypatch)
    _, tag_id, tag_code, synced = await synced_booking(client, headers)

    ndef = json.loads(synced["ndef_record"])
    ndef["status"] = "LOADED"
    response = await client.post(
        f"/api/v1/tags/{tag_code}/tap",
        json={"ndef_payload": json.dumps(ndef), "reader_id": "ESP32-PN532-01"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["acknowledged"] is True
    assert response.json()["display"]["status"] == "LOADED"

    async with async_session_maker() as session:
        tag = await session.get(Tag, tag_id)
        assert tag is not None and tag.tag_status == "LOADED"
        event = await session.scalar(
            select(BaggageEvent)
            .where(BaggageEvent.tag_id == tag_id)
            .order_by(BaggageEvent.created_at.desc())
        )
        assert event is not None
        assert event.event_type == "LOADED"
        assert event.reader_id == "ESP32-PN532-01"


async def test_tap_with_explicit_status(client: AsyncClient, monkeypatch):
    headers = await member_headers(client, monkeypatch)
    _, tag_id, tag_code, _ = await synced_booking(client, headers)

    response = await client.post(
        f"/api/v1/tags/{tag_code}/tap",
        json={"next_status": "arrived", "location_code": "NRT-BELT-4"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["display"]["status"] == "ARRIVED"
    assert response.json()["display"]["banner"] == "ARRIVED"

    async with async_session_maker() as session:
        tag = await session.get(Tag, tag_id)
        assert tag is not None and tag.tag_status == "ARRIVED"


async def test_tap_rejects_bad_payloads(client: AsyncClient, monkeypatch):
    headers = await member_headers(client, monkeypatch)
    _, _, tag_code, synced = await synced_booking(client, headers)
    ndef = json.loads(synced["ndef_record"])

    wrong_barcode = dict(ndef, barcode="0000000000")
    mismatch = await client.post(
        f"/api/v1/tags/{tag_code}/tap",
        json={"ndef_payload": json.dumps(wrong_barcode)},
    )
    assert mismatch.status_code == 409

    malformed = await client.post(
        f"/api/v1/tags/{tag_code}/tap", json={"ndef_payload": "{not json"}
    )
    assert malformed.status_code == 422

    unknown_status = await client.post(
        f"/api/v1/tags/{tag_code}/tap", json={"next_status": "TELEPORTED"}
    )
    assert unknown_status.status_code == 422

    unknown_tag = await client.post(
        "/api/v1/tags/04:FF:FF:FF:FF:FF:FF/tap", json={"next_status": "LOADED"}
    )
    assert unknown_tag.status_code == 404


async def test_tap_requires_device_key_when_configured(client: AsyncClient, monkeypatch):
    headers = await member_headers(client, monkeypatch)
    _, _, tag_code, _ = await synced_booking(client, headers)
    monkeypatch.setattr(
        "app.api.v1.endpoints.tags.get_settings",
        lambda: SimpleNamespace(iot_device_key="secret"),
    )

    denied = await client.post(
        f"/api/v1/tags/{tag_code}/tap", json={"next_status": "LOADED"}
    )
    assert denied.status_code == 401

    allowed = await client.post(
        f"/api/v1/tags/{tag_code}/tap",
        json={"next_status": "LOADED"},
        headers={"X-Device-Key": "secret"},
    )
    assert allowed.status_code == 200, allowed.text


async def test_display_falls_back_to_demo_bag(client: AsyncClient):
    response = await client.get("/api/v1/tags/04:A2:3B:4C:5D:6E:70/display")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["flight"] == "CX888"
    assert body["destination"] == "YVR"
    assert body["banner"]


async def test_mobile_baggage_sync_mirrors_into_database(client: AsyncClient, monkeypatch):
    headers = await member_headers(client, monkeypatch)
    _, tag_id, tag_code, _ = await synced_booking(client, headers)

    sync = await client.post(
        "/api/v1/baggage/sync",
        json={
            "tag_number": uuid4().hex[:10],
            "tag_code": tag_code,
            "initial_status": "SYNCHRONIZED",
        },
    )
    assert sync.status_code == 200, sync.text

    async with async_session_maker() as session:
        event = await session.scalar(
            select(BaggageEvent)
            .where(BaggageEvent.tag_id == tag_id)
            .order_by(BaggageEvent.created_at.desc())
        )
        assert event is not None and event.event_type == "SYNCHRONIZED"


async def test_staff_scan_mirrors_into_database(client: AsyncClient, monkeypatch):
    headers = await member_headers(client, monkeypatch)
    _, tag_id, _, _ = await synced_booking(client, headers)

    async with async_session_maker() as session:
        await session.execute(delete(Tag).where(Tag.bar_code_payload == "0160892014"))
        await session.commit()
        tag = await session.get(Tag, tag_id)
        assert tag is not None
        tag.bar_code_payload = "0160892014"
        tag.baggage_barcode = "0160892014"
        await session.commit()

    scan = await client.post(
        "/api/v1/baggage/0160892014/scan",
        json={"event_type": "MISROUTED", "location_code": "HKG-TRANSFER-BAY-2"},
    )
    assert scan.status_code == 200, scan.text

    async with async_session_maker() as session:
        tag = await session.get(Tag, tag_id)
        assert tag is not None and tag.tag_status == "MISROUTED"
        event = await session.scalar(
            select(BaggageEvent)
            .where(BaggageEvent.tag_id == tag_id)
            .order_by(BaggageEvent.created_at.desc())
        )
        assert event is not None and event.event_type == "MISROUTED"
