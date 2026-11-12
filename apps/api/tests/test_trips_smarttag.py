from uuid import UUID, uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core.database import async_session_maker
from app.main import app
from app.models.baggage import Tag
from app.models.booking import Booking
from app.models.flight import Flight


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


async def member_headers(
    client: AsyncClient, monkeypatch, family_name: str = "CHAN"
) -> dict[str, str]:
    sent: list[str] = []

    async def fake_send(channel: str, destination: str, code: str) -> None:
        sent.append(code)

    monkeypatch.setattr("app.api.v1.endpoints.auth.send_verification_code", fake_send)
    email = f"traveller-{uuid4().hex[:8]}@example.com"
    initiated = await client.post("/api/v1/auth/signup/initiate", json={"email": email})
    signup_id = initiated.json()["signup_id"]

    verified = await client.post(
        "/api/v1/auth/signup/verify",
        json={
            "signup_id": signup_id,
            "code": sent[-1],
            "password": "Passw0rd!",
            "family_name": family_name,
            "given_names": "TAI MAN",
        },
    )
    assert verified.status_code == 200, verified.text
    return {"Authorization": f"Bearer {verified.json()['access_token']}"}


async def seeded_flight(flight_number: str) -> Flight:
    async with async_session_maker() as session:
        flight = await session.scalar(
            select(Flight).where(Flight.flight_number == flight_number)
        )
    assert flight is not None, f"seeded flight {flight_number} missing"
    return flight


async def make_tag() -> UUID:
    async with async_session_maker() as session:
        tag = Tag(tag_code=f"TAG-{uuid4().hex[:12]}")
        session.add(tag)
        await session.commit()
        await session.refresh(tag)
        return tag.id


async def make_booking(
    flight_id: UUID,
    *,
    user_id: UUID | None = None,
    status: str = "UPCOMING",
    checkin: bool = False,
) -> tuple[UUID, str]:
    pnr = uuid4().hex[:6].upper()
    async with async_session_maker() as session:
        booking = Booking(
            pnr=pnr,
            flight_id=flight_id,
            user_id=user_id,
            booking_status=status,
            checkin_status=checkin,
        )
        session.add(booking)
        await session.commit()
        await session.refresh(booking)
        return booking.id, pnr


async def create_booking(
    client: AsyncClient, headers: dict[str, str], flight_id: UUID, **overrides: object
) -> dict[str, object]:
    payload: dict[str, object] = {
        "pnr": uuid4().hex[:6].upper(),
        "flight_id": str(flight_id),
    }
    payload.update(overrides)
    response = await client.post("/api/v1/bookings", json=payload, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


async def test_search_return_trip(client: AsyncClient):
    outbound = await seeded_flight("CX548")
    inbound = await seeded_flight("CX549")

    response = await client.post(
        "/api/v1/flights/search",
        json={
            "origin": "HKG",
            "destination": "NRT",
            "departure_date": outbound.departure_time.date().isoformat(),
            "return_date": inbound.departure_time.date().isoformat(),
            "trip_type": "RETURN",
            "cabin_class": "BUSINESS",
            "passenger_count": 2,
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["trip_type"] == "RETURN"
    assert body["outbound"]
    assert body["return"]
    assert body["outbound"][0]["destination_code"] == "NRT"
    assert body["return"][0]["destination_code"] == "HKG"


async def test_search_multi_city(client: AsyncClient):
    first = await seeded_flight("CX548")
    second = await seeded_flight("CX549")

    response = await client.post(
        "/api/v1/flights/search",
        json={
            "trip_type": "MULTI_CITY",
            "cabin_class": "ECONOMY",
            "passenger_count": 1,
            "legs": [
                {
                    "origin": "HKG",
                    "destination": "NRT",
                    "departure_date": first.departure_time.date().isoformat(),
                },
                {
                    "origin": "NRT",
                    "destination": "HKG",
                    "departure_date": second.departure_time.date().isoformat(),
                },
            ],
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert len(body["multi_city"]) == 2
    assert body["multi_city"][0][0]["flight_number"] == "CX548"
    assert body["multi_city"][1][0]["flight_number"] == "CX549"


async def test_search_rejects_incomplete_trip(client: AsyncClient):
    missing_legs = await client.post(
        "/api/v1/flights/search", json={"trip_type": "MULTI_CITY"}
    )
    assert missing_legs.status_code == 422

    missing_return_date = await client.post(
        "/api/v1/flights/search",
        json={
            "origin": "HKG",
            "destination": "NRT",
            "departure_date": "2026-12-01",
            "trip_type": "RETURN",
        },
    )
    assert missing_return_date.status_code == 422


async def test_trips_tabs_and_card_fields(client: AsyncClient, monkeypatch):
    headers = await member_headers(client, monkeypatch)
    flight = await seeded_flight("CX255")

    upcoming = await create_booking(client, headers, flight.id)
    past = await create_booking(client, headers, flight.id, booking_status="PAST")
    cancelled = await create_booking(client, headers, flight.id, booking_status="CANCELLED")

    default_tab = await client.get("/api/v1/trips", headers=headers)
    assert default_tab.status_code == 200, default_tab.text
    upcoming_ids = {card["booking_id"] for card in default_tab.json()}
    assert str(upcoming["id"]) in upcoming_ids
    assert str(past["id"]) not in upcoming_ids

    card = next(c for c in default_tab.json() if c["booking_id"] == upcoming["id"])
    assert card["flight_number"] == "CX255"
    assert card["origin_code"] == "HKG"
    assert card["destination_code"] == "NKG"
    assert card["terminal"]
    assert card["gate"]
    assert card["allowed_bags"] == 2
    assert card["selected_bags"] == 1
    assert card["smarttag_ready"] is False

    past_tab = await client.get("/api/v1/trips?tab=PAST", headers=headers)
    assert [c["booking_id"] for c in past_tab.json()] == [past["id"]]

    cancelled_tab = await client.get("/api/v1/trips?tab=CANCELLED", headers=headers)
    assert [c["booking_id"] for c in cancelled_tab.json()] == [cancelled["id"]]


async def test_add_trip_claims_unowned_booking(client: AsyncClient, monkeypatch):
    headers = await member_headers(client, monkeypatch, family_name="CHAN")
    flight = await seeded_flight("CX255")
    booking_id, pnr = await make_booking(flight.id)

    response = await client.post(
        "/api/v1/trips/add", json={"pnr": pnr, "last_name": "CHAN"}, headers=headers
    )
    assert response.status_code == 200, response.text
    assert response.json()["booking_id"] == str(booking_id)
    assert response.json()["smarttag_ready"] is False

    async with async_session_maker() as session:
        booking = await session.get(Booking, booking_id)
        assert booking is not None and booking.user_id is not None
        owner_id = booking.user_id

    trips = await client.get("/api/v1/trips", headers=headers)
    assert str(booking_id) in {card["booking_id"] for card in trips.json()}

    # Re-importing your own booking is harmless.
    again = await client.post(
        "/api/v1/trips/add", json={"pnr": pnr, "last_name": "CHAN"}, headers=headers
    )
    assert again.status_code == 200
    async with async_session_maker() as session:
        booking = await session.get(Booking, booking_id)
        assert booking is not None and booking.user_id == owner_id


async def test_add_trip_rejects_wrong_surname_and_unknown_pnr(
    client: AsyncClient, monkeypatch
):
    headers = await member_headers(client, monkeypatch, family_name="CHAN")
    flight = await seeded_flight("CX255")
    _, pnr = await make_booking(flight.id)

    wrong_name = await client.post(
        "/api/v1/trips/add", json={"pnr": pnr, "last_name": "LEE"}, headers=headers
    )
    assert wrong_name.status_code == 404

    unknown = await client.post(
        "/api/v1/trips/add", json={"pnr": "ZZZZZ9", "last_name": "CHAN"}, headers=headers
    )
    assert unknown.status_code == 404


async def test_add_trip_rejects_booking_owned_by_someone_else(
    client: AsyncClient, monkeypatch
):
    owner_headers = await member_headers(client, monkeypatch, family_name="LEE")
    profile = await client.get("/api/v1/users/profile", headers=owner_headers)
    owner_id = UUID(profile.json()["id"])

    headers = await member_headers(client, monkeypatch, family_name="CHAN")
    flight = await seeded_flight("CX255")
    _, pnr = await make_booking(flight.id, user_id=owner_id)

    response = await client.post(
        "/api/v1/trips/add", json={"pnr": pnr, "last_name": "CHAN"}, headers=headers
    )
    assert response.status_code == 409


async def test_prepare_requires_ownership(client: AsyncClient, monkeypatch):
    owner = await member_headers(client, monkeypatch)
    stranger = await member_headers(client, monkeypatch)
    flight = await seeded_flight("CX255")
    booking = await create_booking(client, owner, flight.id)

    response = await client.get(
        f"/api/v1/smarttag/prepare/{booking['id']}", headers=stranger
    )
    assert response.status_code == 404


async def test_prepare_flags_before_and_after_link(client: AsyncClient, monkeypatch):
    headers = await member_headers(client, monkeypatch)
    flight = await seeded_flight("CX255")
    booking = await create_booking(client, headers, flight.id)

    before = await client.get(
        f"/api/v1/smarttag/prepare/{booking['id']}", headers=headers
    )
    assert before.status_code == 200, before.text
    assert before.json()["demo_checkin_completed"] is False
    assert before.json()["smarttag_available"] is False
    assert before.json()["ready"] is False
    assert before.json()["allowed_bags"] == 2

    tag_id = await make_tag()
    await client.post(
        "/api/v1/bookings/link-tag",
        json={"pnr": booking["pnr"], "tag_id": str(tag_id)},
        headers=headers,
    )

    after = await client.get(
        f"/api/v1/smarttag/prepare/{booking['id']}", headers=headers
    )
    assert after.status_code == 200, after.text
    assert after.json()["demo_checkin_completed"] is True
    assert after.json()["smarttag_available"] is True
    assert after.json()["tag_id"] == str(tag_id)
    assert after.json()["sync_state"] == "PREPARE"
    assert after.json()["ready"] is True


async def test_sync_requires_checkin(client: AsyncClient, monkeypatch):
    headers = await member_headers(client, monkeypatch)
    flight = await seeded_flight("CX255")
    booking = await create_booking(client, headers, flight.id)

    response = await client.post(
        "/api/v1/smarttag/sync/payload",
        json={"booking_id": booking["id"]},
        headers=headers,
    )
    assert response.status_code == 409
    assert "check-in" in response.json()["detail"].lower()


async def test_sync_requires_bound_tag(client: AsyncClient, monkeypatch):
    headers = await member_headers(client, monkeypatch)
    flight = await seeded_flight("CX255")
    booking = await create_booking(client, headers, flight.id, checkin_status=True)

    response = await client.post(
        "/api/v1/smarttag/sync/payload",
        json={"booking_id": booking["id"]},
        headers=headers,
    )
    assert response.status_code == 409
    assert "smarttag" in response.json()["detail"].lower()


async def test_sync_and_simulation(client: AsyncClient, monkeypatch):
    headers = await member_headers(client, monkeypatch)
    flight = await seeded_flight("CX548")
    booking = await create_booking(client, headers, flight.id)
    tag_id = await make_tag()
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
    body = synced.json()
    assert body["sync_state"] == "READY"
    assert body["is_simulated"] is False
    assert body["mqtt_published"] is False
    assert len(body["nfc_payload_hash"]) == 64
    assert body["bar_code_payload"].startswith("016")
    assert len(body["bar_code_payload"]) == 10
    assert "CX548" in body["ndef_record"]
    assert body["display_payload"]["route"] == "HKG->NRT"

    async with async_session_maker() as session:
        tag = await session.get(Tag, tag_id)
        assert tag is not None
        assert tag.sync_state == "READY"
        assert tag.is_simulated is False
        assert tag.nfc_payload_hash == body["nfc_payload_hash"]
        assert tag.bar_code_payload == body["bar_code_payload"]
        assert tag.booking_id == UUID(str(booking["id"]))
        assert tag.last_synced_at is not None

    simulated = await client.post(
        "/api/v1/smarttag/sync/simulation",
        json={"booking_id": booking["id"], "hardware_nfc_id": str(tag_id)},
        headers=headers,
    )
    assert simulated.status_code == 200, simulated.text
    assert simulated.json()["is_simulated"] is True
    async with async_session_maker() as session:
        tag = await session.get(Tag, tag_id)
        assert tag is not None and tag.is_simulated is True
        assert tag.sync_state == "READY"
