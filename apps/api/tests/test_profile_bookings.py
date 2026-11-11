from uuid import UUID, uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.database import async_session_maker
from app.main import app
from app.models.baggage import Tag


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


async def member_headers(client: AsyncClient, monkeypatch) -> dict[str, str]:
    sent: list[str] = []

    async def fake_send(channel: str, destination: str, code: str) -> None:
        sent.append(code)

    monkeypatch.setattr("app.api.v1.endpoints.auth.send_verification_code", fake_send)
    email = f"member-{uuid4().hex[:8]}@example.com"
    initiated = await client.post("/api/v1/auth/signup/initiate", json={"email": email})
    signup_id = initiated.json()["signup_id"]

    verified = await client.post(
        "/api/v1/auth/signup/verify",
        json={"signup_id": signup_id, "code": sent[-1], "password": "Passw0rd!"},
    )
    assert verified.status_code == 200, verified.text
    return {"Authorization": f"Bearer {verified.json()['access_token']}"}


async def make_tag() -> UUID:
    async with async_session_maker() as session:
        tag = Tag(tag_code=f"TAG-{uuid4().hex[:12]}")
        session.add(tag)
        await session.commit()
        await session.refresh(tag)
        return tag.id


def booking_payload(pnr: str | None = None) -> dict[str, object]:
    return {
        "pnr": pnr or uuid4().hex[:6].upper(),
        "flight_number": "CX255",
        "origin": "HKG",
        "destination": "NKG",
        "departure_date": "2026-12-01T09:00:00Z",
        "cabin_class": "Economy",
        "passenger_count": 1,
    }


async def test_profile_requires_auth(client: AsyncClient):
    assert (await client.get("/api/v1/users/profile")).status_code == 401


async def test_profile_returns_member_details(client: AsyncClient, monkeypatch):
    headers = await member_headers(client, monkeypatch)
    response = await client.get("/api/v1/users/profile", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["membership_number"].startswith("1906")
    assert body["membership_tier"] == "GREEN"
    assert body["status_points"] == 0


async def test_preferences_full_replace(client: AsyncClient, monkeypatch):
    headers = await member_headers(client, monkeypatch)

    updated = await client.put(
        "/api/v1/users/preferences",
        headers=headers,
        json={
            "email_notifications": False,
            "sms_notifications": True,
            "promotional_offers": True,
        },
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["communication_prefs"] == {
        "email_notifications": False,
        "sms_notifications": True,
        "promotional_offers": True,
    }

    profile = await client.get("/api/v1/users/profile", headers=headers)
    assert profile.json()["communication_prefs"]["sms_notifications"] is True


async def test_flight_search_returns_seeded_schedule(client: AsyncClient):
    response = await client.get(
        "/api/v1/flights/search", params={"origin": "HKG", "destination": "NKG"}
    )
    assert response.status_code == 200, response.text
    flights = response.json()
    assert flights
    assert flights[0]["origin"] == "HKG"
    assert flights[0]["destination"] == "NKG"
    assert flights[0]["flight_number"].startswith("CX")


async def test_flight_search_validates_airport_code(client: AsyncClient):
    response = await client.get(
        "/api/v1/flights/search", params={"origin": "HK", "destination": "NKG"}
    )
    assert response.status_code == 422


async def test_create_booking_requires_auth(client: AsyncClient):
    response = await client.post("/api/v1/bookings", json=booking_payload())
    assert response.status_code == 401


async def test_create_booking_and_reject_duplicate_pnr(client: AsyncClient, monkeypatch):
    headers = await member_headers(client, monkeypatch)
    payload = booking_payload()

    created = await client.post("/api/v1/bookings", json=payload, headers=headers)
    assert created.status_code == 201, created.text
    assert created.json()["booking_status"] == "CONFIRMED"
    assert "tag_id" not in created.json()

    duplicate = await client.post("/api/v1/bookings", json=payload, headers=headers)
    assert duplicate.status_code == 409


async def test_link_tag_errors(client: AsyncClient, monkeypatch):
    headers = await member_headers(client, monkeypatch)

    unknown_booking = await client.post(
        "/api/v1/bookings/link-tag",
        json={"pnr": "ZZZZZ1", "tag_id": str(uuid4())},
        headers=headers,
    )
    assert unknown_booking.status_code == 404

    created = await client.post("/api/v1/bookings", json=booking_payload(), headers=headers)
    unknown_tag = await client.post(
        "/api/v1/bookings/link-tag",
        json={"pnr": created.json()["pnr"], "tag_id": str(uuid4())},
        headers=headers,
    )
    assert unknown_tag.status_code == 404


async def test_link_tag_binds_and_rebinds(client: AsyncClient, monkeypatch):
    headers = await member_headers(client, monkeypatch)
    first_tag = await make_tag()
    second_tag = await make_tag()

    first = await client.post("/api/v1/bookings", json=booking_payload(), headers=headers)
    second = await client.post("/api/v1/bookings", json=booking_payload(), headers=headers)
    first_pnr = first.json()["pnr"]
    second_pnr = second.json()["pnr"]

    linked = await client.post(
        "/api/v1/bookings/link-tag",
        json={"pnr": first_pnr, "tag_id": str(first_tag)},
        headers=headers,
    )
    assert linked.status_code == 200, linked.text

    async with async_session_maker() as session:
        bound = await session.get(Tag, first_tag)
        assert bound is not None
        assert bound.pnr == first_pnr
        assert bound.user_id is not None
        assert bound.tag_status == "CHECKED_IN"
        assert bound.last_synced_at is not None

    # A second tag on the same booking releases the first one.
    await client.post(
        "/api/v1/bookings/link-tag",
        json={"pnr": first_pnr, "tag_id": str(second_tag)},
        headers=headers,
    )
    async with async_session_maker() as session:
        released = await session.get(Tag, first_tag)
        rebound = await session.get(Tag, second_tag)
        assert released is not None and released.pnr is None
        assert released.tag_status == "UNLINKED"
        assert rebound is not None and rebound.pnr == first_pnr

    # Reusing the tag on another booking moves it there.
    moved = await client.post(
        "/api/v1/bookings/link-tag",
        json={"pnr": second_pnr, "tag_id": str(second_tag)},
        headers=headers,
    )
    assert moved.status_code == 200
    async with async_session_maker() as session:
        tag = await session.get(Tag, second_tag)
        assert tag is not None
        assert tag.pnr == second_pnr
