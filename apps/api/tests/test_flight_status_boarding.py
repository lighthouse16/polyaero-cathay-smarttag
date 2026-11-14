from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.main import app
from app.models.auth import User
from app.models.booking import Booking
from app.models.flight import Flight


@pytest.fixture
async def flight_client(seed_engine, monkeypatch):
    day = datetime(2026, 11, 14, tzinfo=UTC)
    with Session(seed_engine, expire_on_commit=False) as session, session.begin():
        owner = User(email="owner@example.com", family_name="SEED", given_names="PASSENGER")
        other = User(email="other@example.com")
        flight = Flight(
            flight_number="CX123",
            origin="HKG",
            destination="NRT",
            departure_time=day,
            arrival_time=day + timedelta(hours=4),
            gate="12",
            terminal="1",
        )
        session.add_all([owner, other, flight])
        session.flush()
        booking = Booking(
            user_id=owner.id,
            flight_id=flight.id,
            pnr="TEST01",
            checkin_status=True,
            cabin_class="BUSINESS",
        )
        session.add_all(
            [
                booking,
                Flight(
                    flight_number="CX123",
                    origin="HKG",
                    destination="NKG",
                    departure_time=day + timedelta(hours=1),
                    arrival_time=day + timedelta(hours=3),
                ),
                Flight(
                    flight_number="CX123",
                    origin="HKG",
                    destination="NRT",
                    departure_time=day + timedelta(days=1),
                    arrival_time=day + timedelta(days=1, hours=4),
                ),
            ]
        )
    async_engine = create_async_engine(
        seed_engine.url.set(drivername="postgresql+asyncpg"),
        execution_options=seed_engine.get_execution_options(),
    )

    async def db():
        async with AsyncSession(async_engine) as session:
            yield session

    monkeypatch.setitem(app.dependency_overrides, get_db, db)
    monkeypatch.setitem(app.dependency_overrides, get_current_user, lambda: owner)
    monkeypatch.setattr(
        "app.core.security.get_settings",
        lambda: SimpleNamespace(
            flight_status_staff_key="test-staff-key",
        ),
    )
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            yield client, flight, booking, other
    finally:
        await async_engine.dispose()


async def test_status_lookup_is_date_specific_and_unknown_until_reported(flight_client):
    client, _, _, _ = flight_client
    response = await client.get(
        "/api/v1/flights/status",
        params={
            "flight_number": " cx123 ",
            "departure_date": "2026-11-14",
        },
    )
    assert response.status_code == 200, response.text
    assert len(response.json()) == 2
    assert all(
        row["operational_status"] == "UNKNOWN" and row["status_reported_at"] is None
        for row in response.json()
    )
    assert {row["destination"] for row in response.json()} == {"NRT", "NKG"}
    missing = await client.get(
        "/api/v1/flights/status",
        params={
            "flight_number": "CX123",
            "departure_date": "2026-11-16",
        },
    )
    assert missing.status_code == 200 and missing.json() == []


async def test_staff_update_persists_and_updates_pass_gate(flight_client, seed_engine):
    client, flight, booking, _ = flight_client
    result = await client.patch(
        f"/api/v1/flights/{flight.id}/status",
        headers={"X-Flight-Staff-Key": "test-staff-key"},
        json={
            "operational_status": "DELAYED",
            "gate": "24",
            "estimated_departure_time": "2026-11-14T09:00:00Z",
            "estimated_arrival_time": "2026-11-14T13:00:00Z",
        },
    )
    assert result.status_code == 200, result.text
    assert result.json()["source"] == "STAFF_REPORTED_DATABASE"
    assert result.json()["status_reported_at"] is not None
    with Session(seed_engine) as session:
        stored = session.get(Flight, flight.id)
        assert stored.operational_status == "DELAYED" and stored.gate == "24"
    boarding = await client.get(f"/api/v1/bookings/{booking.id}/boarding-pass")
    assert boarding.status_code == 200, boarding.text
    assert boarding.json()["flight"]["gate"] == "24"
    assert boarding.json()["flight"]["operational_status"] == "DELAYED"
    partial = await client.patch(
        f"/api/v1/flights/{flight.id}/status",
        headers={"X-Flight-Staff-Key": "test-staff-key"},
        json={"operational_status": "BOARDING", "estimated_departure_time": "2026-11-14T14:00:00Z"},
    )
    assert partial.status_code == 422
    with Session(seed_engine) as session:
        assert session.get(Flight, flight.id).operational_status == "DELAYED"


@pytest.mark.parametrize("key", [None, "wrong-key"])
async def test_passenger_cannot_update_flights(flight_client, key):
    client, flight, _, _ = flight_client
    headers = {"X-Flight-Staff-Key": key} if key else {}
    response = await client.patch(
        f"/api/v1/flights/{flight.id}/status",
        json={"operational_status": "ARRIVED"},
        headers=headers,
    )
    assert response.status_code == 401


async def test_staff_can_clear_optional_fields_without_losing_omitted_fields(flight_client):
    client, flight, _, _ = flight_client
    headers = {"X-Flight-Staff-Key": "test-staff-key"}
    response = await client.patch(
        f"/api/v1/flights/{flight.id}/status",
        headers=headers,
        json={"operational_status": "SCHEDULED", "gate": None},
    )
    assert response.status_code == 200, response.text
    assert response.json()["gate"] is None and response.json()["terminal"] == "1"
    missing = await client.patch(
        f"/api/v1/flights/{uuid4()}/status",
        headers=headers,
        json={"operational_status": "SCHEDULED"},
    )
    assert missing.status_code == 404


async def test_missing_staff_configuration_fails_closed(flight_client, monkeypatch):
    client, flight, _, _ = flight_client
    monkeypatch.setattr(
        "app.core.security.get_settings",
        lambda: SimpleNamespace(
            flight_status_staff_key=None,
        ),
    )
    response = await client.patch(
        f"/api/v1/flights/{flight.id}/status",
        json={"operational_status": "ARRIVED"},
    )
    assert response.status_code == 503


@pytest.mark.parametrize(
    "payload",
    [
        {"operational_status": "ON_TIME"},
        {"operational_status": "DELAYED", "estimated_departure_time": "2026-11-14T09:00:00"},
        {
            "operational_status": "ARRIVED",
            "actual_departure_time": "2026-11-14T13:00:00Z",
            "actual_arrival_time": "2026-11-14T12:00:00Z",
        },
        {"operational_status": "BOARDING", "status_reported_at": "2026-11-14T09:00:00Z"},
    ],
)
async def test_bad_staff_updates_are_rejected(flight_client, payload):
    client, flight, _, _ = flight_client
    response = await client.patch(
        f"/api/v1/flights/{flight.id}/status",
        headers={"X-Flight-Staff-Key": "test-staff-key"},
        json=payload,
    )
    assert response.status_code == 422


async def test_pass_is_owned_private_and_explicitly_not_valid(flight_client, monkeypatch):
    client, _, booking, other = flight_client
    response = await client.get(f"/api/v1/bookings/{booking.id}/boarding-pass")
    assert response.status_code == 200, response.text
    assert response.headers["cache-control"] == "no-store"
    body = response.json()
    assert body["pnr"] == booking.pnr and body["passenger_name"] == "SEED PASSENGER"
    assert body["valid_for_boarding"] is False
    assert body["notice"] == "PROTOTYPE - NOT VALID FOR BOARDING"
    assert body["seat_number"] is None
    monkeypatch.setitem(app.dependency_overrides, get_current_user, lambda: other)
    denied = await client.get(f"/api/v1/bookings/{booking.id}/boarding-pass")
    unknown = await client.get(f"/api/v1/bookings/{uuid4()}/boarding-pass")
    assert denied.status_code == unknown.status_code == 404
    assert denied.json() == unknown.json()
    monkeypatch.delitem(app.dependency_overrides, get_current_user)
    anonymous = await client.get(f"/api/v1/bookings/{booking.id}/boarding-pass")
    assert anonymous.status_code == 401


@pytest.mark.parametrize(
    "checkin,booking_status,flight_status",
    [
        (False, "UPCOMING", "UNKNOWN"),
        (True, "PAST", "UNKNOWN"),
        (True, "CANCELLED", "UNKNOWN"),
        (True, "UPCOMING", "CANCELLED"),
        (True, "UPCOMING", "DEPARTED"),
        (True, "UPCOMING", "ARRIVED"),
    ],
)
async def test_ineligible_booking_has_no_pass(
    flight_client,
    seed_engine,
    checkin,
    booking_status,
    flight_status,
):
    client, flight, booking, _ = flight_client
    with Session(seed_engine) as session, session.begin():
        stored_booking = session.get(Booking, booking.id)
        stored_booking.checkin_status = checkin
        stored_booking.booking_status = booking_status
        session.get(Flight, flight.id).operational_status = flight_status
    response = await client.get(f"/api/v1/bookings/{booking.id}/boarding-pass")
    assert response.status_code == 409
