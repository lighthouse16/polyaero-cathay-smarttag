from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.main import app
from app.models.auth import User
from app.models.baggage import Baggage, Tag
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


async def test_upcoming_flights_are_public_complete_ordered_and_not_departed(
    flight_client, seed_engine, monkeypatch
):
    client, flight, _, _ = flight_client
    now = flight.departure_time

    class Clock(datetime):
        @classmethod
        def now(cls, tz=None):
            return now

    monkeypatch.setattr("app.api.v1.endpoints.flights.datetime", Clock)
    monkeypatch.delitem(app.dependency_overrides, get_current_user)
    with Session(seed_engine) as session, session.begin():
        session.add(
            Flight(
                id=UUID(int=1),
                flight_number="CX100",
                origin="NRT",
                destination="HKG",
                departure_time=now,
                arrival_time=now + timedelta(hours=4),
            )
        )
        for status in ("DELAYED", "BOARDING"):
            session.add(
                Flight(
                    flight_number="CX101",
                    origin="HKG",
                    destination="LHR",
                    departure_time=now + timedelta(hours=2),
                    arrival_time=now + timedelta(hours=14),
                    operational_status=status,
                )
            )
        for changes in (
            {"departure_time": now - timedelta(minutes=1)},
            {
                "departure_time": now - timedelta(minutes=1),
                "operational_status": "DELAYED",
                "estimated_departure_time": now + timedelta(hours=1),
            },
            {"operational_status": "CANCELLED"},
            {"operational_status": "DEPARTED"},
            {"operational_status": "ARRIVED"},
            {"actual_departure_time": now - timedelta(minutes=1)},
            {"actual_arrival_time": now - timedelta(minutes=1)},
        ):
            session.add(
                Flight(
                    **{
                        "flight_number": "CX999",
                        "origin": "HKG",
                        "destination": "NRT",
                        "departure_time": now + timedelta(hours=1),
                        "arrival_time": now + timedelta(hours=5),
                        **changes,
                    }
                )
            )
    response = await client.get("/api/v1/flights/upcoming")
    assert response.status_code == 200, response.text
    rows = response.json()
    assert len(rows) == 6
    assert all(
        (
            row["weather_severity"],
            row["load_factor_pct"],
            row["airport_congestion"],
            row["initial_status"],
        )
        == (2, 86.0, 2, "AWAITING_SYNC")
        for row in rows
    )
    assert rows[0]["id"] == str(UUID(int=1))
    assert all(row["flight_number"] != "CX999" for row in rows)
    assert {"UNKNOWN", "DELAYED", "BOARDING"} == {row["operational_status"] for row in rows}
    assert [(row["departure_time"], row["id"]) for row in rows] == sorted(
        (row["departure_time"], row["id"]) for row in rows
    )


async def test_upcoming_flights_return_an_empty_list_when_all_flights_are_past(
    flight_client, monkeypatch
):
    client, flight, _, _ = flight_client
    now = flight.departure_time + timedelta(days=2)

    class Clock(datetime):
        @classmethod
        def now(cls, tz=None):
            return now

    monkeypatch.setattr("app.api.v1.endpoints.flights.datetime", Clock)
    response = await client.get("/api/v1/flights/upcoming")
    assert response.status_code == 200 and response.json() == []


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


async def test_shared_flight_fields_drive_baggage_and_default_does_not_claim_sync(
    flight_client, seed_engine, monkeypatch
):
    client, flight, booking, _ = flight_client
    with Session(seed_engine) as session, session.begin():
        stored = session.get(Flight, flight.id)
        stored.weather_severity = 4
        stored.load_factor_pct = 94.5
        stored.airport_congestion = 3
        stored.initial_status = "CHECKED_IN"
        session.add(
            Tag(
                tag_code="SHARED-FLIGHT-TAG",
                user_id=booking.user_id,
                booking_id=booking.id,
            )
        )
    from app.api.v1.endpoints import baggage as baggage_api

    observed = []
    predict = baggage_api.ACTIVE_RISK_MODEL.predict

    def capture(features):
        observed.append(features)
        return predict(features)

    monkeypatch.setattr(baggage_api.ACTIVE_RISK_MODEL, "predict", capture)
    synced = await client.post(
        "/api/v1/baggage/sync",
        json={
            "tag_code": "SHARED-FLIGHT-TAG",
            "connection_minutes": 37,
        },
    )
    assert synced.status_code == 200, synced.text
    assert synced.json()["status"] == "CHECKED_IN" and not synced.json()["is_tag_synced"]
    assert synced.json()["flight_id"] == str(booking.flight_id)
    assert (
        observed[-1].weather_severity,
        observed[-1].load_factor_pct,
        observed[-1].airport_congestion,
        observed[-1].transfer_minutes,
    ) == (4, 94.5, 3, 37)
    with Session(seed_engine) as session:
        bag = session.get(Baggage, synced.json()["id"])
        assert bag.flight_id == booking.flight_id and bag.connection_minutes == 37

    confirmed = await client.post(
        "/api/v1/baggage/sync",
        json={
            "tag_code": "SHARED-FLIGHT-TAG",
            "sync_status": "TAGGED",
        },
    )
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["status"] == "TAGGED" and confirmed.json()["is_tag_synced"]
    changed = await client.patch(
        f"/api/v1/flights/{flight.id}/status",
        headers={"X-Flight-Staff-Key": "test-staff-key"},
        json={
            "operational_status": "DELAYED",
            "weather_severity": 5,
            "load_factor_pct": 99,
            "airport_congestion": 4,
            "initial_status": "AWAITING_SYNC",
            "gate": "29",
        },
    )
    assert changed.status_code == 200, changed.text
    detail = await client.get("/api/v1/baggage/SHARED-FLIGHT-TAG")
    assert detail.status_code == 200, detail.text
    assert detail.json()["weather_severity"] == 5 and detail.json()["connection_minutes"] == 37
    assert (
        detail.json()["status"] == "TAGGED" and detail.json()["initial_status"] == "AWAITING_SYNC"
    )
    assert observed[-1].weather_severity == 5
    lookup = await client.get(
        "/api/v1/flights/status",
        params={
            "flight_number": flight.flight_number,
            "departure_date": "2026-11-14",
        },
    )
    assert (
        next(row for row in lookup.json() if row["id"] == str(flight.id))["load_factor_pct"] == 99
    )
    options = await client.post(
        "/api/v1/flights/search",
        json={
            "origin": "HKG",
            "destination": "NRT",
            "departure_date": "2026-11-14",
        },
    )
    assert options.status_code == 200 and options.json()["outbound"][0]["weather_severity"] == 5


async def test_baggage_rejects_unowned_tags_and_clients_cannot_override_flight_weather(
    flight_client, seed_engine, monkeypatch
):
    client, flight, booking, other = flight_client
    with Session(seed_engine) as session, session.begin():
        tag = Tag(tag_code="OTHER-FLIGHT-TAG", user_id=other.id)
        session.add(tag)
        session.flush()
        session.add(
            Baggage(
                tag_id=tag.id,
                flight_id=flight.id,
                passenger_name="Other member",
                status="CHECKED_IN",
            )
        )
        session.add(Tag(tag_code="OWN-FLIGHT-TAG", user_id=booking.user_id, booking_id=booking.id))
    listed = await client.get("/api/v1/baggage")
    assert listed.status_code == 200 and listed.json() == []
    denied = await client.get("/api/v1/baggage/OTHER-FLIGHT-TAG")
    assert denied.status_code == 404
    unauthorized = await client.post(
        "/api/v1/baggage/sync",
        json={
            "tag_code": "OTHER-FLIGHT-TAG",
            "flight_id": str(flight.id),
        },
    )
    assert unauthorized.status_code == 404
    override = await client.post(
        "/api/v1/baggage/sync",
        json={
            "tag_code": "OWN-FLIGHT-TAG",
            "weather_severity": 1,
        },
    )
    assert override.status_code == 422
    mismatch = await client.post(
        "/api/v1/baggage/sync",
        json={
            "tag_code": "OWN-FLIGHT-TAG",
            "arrival_airport": "LHR",
        },
    )
    assert mismatch.status_code == 409
    monkeypatch.delitem(app.dependency_overrides, get_current_user)
    assert (await client.get("/api/v1/baggage")).status_code == 401


async def test_repeated_departures_require_a_flight_id_for_unbooked_owned_tags(
    flight_client,
    seed_engine,
):
    client, flight, booking, _ = flight_client
    with Session(seed_engine) as session, session.begin():
        session.add(Tag(tag_code="UNBOOKED-FLIGHT-TAG", user_id=booking.user_id))
    ambiguous = await client.post(
        "/api/v1/baggage/sync",
        json={
            "tag_code": "UNBOOKED-FLIGHT-TAG",
            "flight_number": "CX123",
            "departure_airport": "HKG",
            "arrival_airport": "NRT",
        },
    )
    assert ambiguous.status_code == 409
    exact = await client.post(
        "/api/v1/baggage/sync",
        json={
            "tag_code": "UNBOOKED-FLIGHT-TAG",
            "flight_id": str(flight.id),
        },
    )
    assert exact.status_code == 200, exact.text
    assert exact.json()["flight_id"] == str(flight.id)


@pytest.mark.parametrize(
    "field,value",
    [
        ("weather_severity", 6),
        ("load_factor_pct", 101),
        ("airport_congestion", 0),
        ("initial_status", "TAGGED"),
    ],
)
async def test_invalid_flight_environment_and_sync_defaults_are_rejected(
    flight_client, field, value
):
    client, flight, _, _ = flight_client
    response = await client.patch(
        f"/api/v1/flights/{flight.id}/status",
        headers={"X-Flight-Staff-Key": "test-staff-key"},
        json={"operational_status": "UNKNOWN", field: value},
    )
    assert response.status_code == 422


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
