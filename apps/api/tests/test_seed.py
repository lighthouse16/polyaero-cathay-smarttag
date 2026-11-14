from datetime import date
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.main import app
from app.models.auth import RefreshToken, User, VerificationCode, WebAuthnCredential
from app.models.baggage import Baggage, BaggageEvent, Tag
from app.models.booking import Booking
from app.models.flight import Flight
from app.seed import build_seed_data, main, seed_database
from app.services.auth import verify_password
from app.services.baggage import MILESTONES
from app.services.smarttag import build_display_payload

DAY = date(2026, 11, 14)


def test_preview_never_applies(monkeypatch, capsys):
    monkeypatch.setattr("sys.argv", ["seed", "--date", DAY.isoformat()])

    def fail(*args):
        pytest.fail("Preview attempted a database write")

    monkeypatch.setattr("app.seed.apply_seed", fail)
    main()
    assert "Preview only; no database connection" in capsys.readouterr().out


def test_seed_links_and_snapshot_histories(seed_engine):
    with Session(seed_engine) as session, session.begin():
        counts = seed_database(session, DAY)
        assert counts == {
            "users": 4,
            "flights": 8,
            "bookings": 12,
            "tags": 12,
            "baggage": 10,
            "baggage_events": 50,
        }
        assert {bag.status for bag in session.scalars(select(Baggage))} == MILESTONES
        assert {booking.booking_status for booking in session.scalars(select(Booking))} == {
            "UPCOMING",
            "PAST",
            "CANCELLED",
        }
        for bag in session.scalars(select(Baggage)):
            tag = session.get(Tag, bag.tag_id)
            booking = session.get(Booking, tag.booking_id)
            flight = session.get(Flight, booking.flight_id)
            user = session.get(User, booking.user_id)
            assert tag.user_id == user.id and tag.pnr == booking.pnr
            assert tag.is_simulated and bag.status == tag.tag_status
            assert (bag.flight_number, bag.departure_time) == (
                flight.flight_number,
                flight.departure_time,
            )
            history = session.scalars(
                select(BaggageEvent)
                .where(BaggageEvent.tag_id == tag.id)
                .order_by(BaggageEvent.created_at)
            ).all()
            assert all(event.booking_id == booking.id for event in history)
            assert len({event.created_at for event in history}) == len(history)
            for event in history:
                if event.event_type == "LOADED":
                    assert event.created_at < flight.departure_time
                elif event.event_type in {"ARRIVED", "ON_CAROUSEL", "COLLECTED"}:
                    assert event.created_at > flight.arrival_time
            assert [event for event in history if event.event_type in MILESTONES][
                -1
            ].event_type == bag.status
            assert history[-1].created_at == bag.updated_at == tag.last_seen_at
            display = build_display_payload(tag, booking, flight, user)
            assert display["status"] == bag.status and display["pnr"] == booking.pnr
            assert (tag.nfc_payload_hash is not None) == (tag.sync_state == "READY")
        for model in (RefreshToken, VerificationCode, WebAuthnCredential):
            assert session.scalar(select(func.count()).select_from(model)) == 0
        assert all(user.password_hash is None for user in session.scalars(select(User)))


def test_rerun_preserves_existing_and_progressed_rows(seed_engine):
    with Session(seed_engine) as session, session.begin():
        session.add(User(email="existing@example.com", family_name="ORIGINAL"))
        seed_database(session, DAY)
    with Session(seed_engine) as session, session.begin():
        tag = session.scalar(select(Tag).where(Tag.tag_status == "MISSING"))
        tag.tag_status = "RECOVERY_IN_PROGRESS"
        session.add(
            BaggageEvent(
                tag_id=tag.id,
                booking_id=tag.booking_id,
                event_type="RECOVERY_IN_PROGRESS",
                notes="Later real progress",
            )
        )
        user = session.scalar(select(User).where(User.email == "seed.passenger.1@example.com"))
        user.family_name = "EDITED"
        tag_id, user_id = tag.id, user.id
    with Session(seed_engine) as session, session.begin():
        assert all(count == 0 for count in seed_database(session, DAY).values())
        assert session.get(Tag, tag_id).tag_status == "RECOVERY_IN_PROGRESS"
        assert session.get(User, user_id).family_name == "EDITED"
        assert session.scalar(select(func.count()).select_from(User)) == 5
        assert session.scalar(select(func.count()).select_from(BaggageEvent)) == 51
        assert (
            session.scalar(select(User.family_name).where(User.email == "existing@example.com"))
            == "ORIGINAL"
        )


def test_unique_collision_rolls_back_the_entire_seed(seed_engine):
    data = build_seed_data(DAY)
    with Session(seed_engine) as session, session.begin():
        flight = Flight(**(data[Flight][0] | {"id": uuid4()}))
        session.add(flight)
        session.flush()
        session.add(
            Booking(
                **(
                    data[Booking][0]
                    | {
                        "id": uuid4(),
                        "user_id": None,
                        "flight_id": flight.id,
                    }
                )
            )
        )
    with pytest.raises(IntegrityError), Session(seed_engine) as session, session.begin():
        seed_database(session, DAY)
    with Session(seed_engine) as session:
        assert session.scalar(select(func.count()).select_from(User)) == 0
        assert session.scalar(select(func.count()).select_from(Flight)) == 1
        assert session.scalar(select(func.count()).select_from(Booking)) == 1
        assert session.scalar(select(func.count()).select_from(Tag)) == 0


def test_optional_password_is_hashed_without_changing_existing_accounts(seed_engine):
    with Session(seed_engine) as session, session.begin():
        seed_database(session, DAY, "SeedTestOnly!42")
    with Session(seed_engine) as session, session.begin():
        seed_database(session, DAY, "DifferentTest!42")
        for user in session.scalars(select(User)):
            assert verify_password("SeedTestOnly!42", user.password_hash)
            assert not verify_password("DifferentTest!42", user.password_hash)


@pytest.mark.parametrize("password", ["short", "x" * 73, "\u754c" * 25])
def test_invalid_password_fails_before_writes(password):
    with pytest.raises(ValueError, match="SEED_USER_PASSWORD"):
        build_seed_data(DAY, password)


async def test_seeded_records_are_usable_by_mobile_api(seed_engine, monkeypatch):
    with Session(seed_engine) as session, session.begin():
        seed_database(session, DAY)
        member = session.scalar(select(User).where(User.membership_tier == "GREEN"))
        prepared = session.scalar(select(Booking).where(Booking.pnr == f"SD{DAY:%y%m%d}00"))
        pending = session.scalar(select(Booking).where(Booking.pnr == f"SD{DAY:%y%m%d}10"))
        # Keep detached records readable by the API dependency.
        session.expire_on_commit = False
    engine = create_async_engine(
        seed_engine.url.set(drivername="postgresql+asyncpg"),
        execution_options=seed_engine.get_execution_options(),
    )

    async def db_dependency():
        async with AsyncSession(engine) as session:
            yield session

    monkeypatch.setitem(app.dependency_overrides, get_db, db_dependency)
    monkeypatch.setitem(app.dependency_overrides, get_current_user, lambda: member)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            trips = await client.get("/api/v1/trips")
            assert trips.status_code == 200, trips.text
            assert str(prepared.id) in {trip["booking_id"] for trip in trips.json()}
            ready = await client.get(f"/api/v1/smarttag/prepare/{prepared.id}")
            assert ready.status_code == 200 and ready.json()["ready"] is True
            # Pending booking belongs to a different member.
            with Session(seed_engine) as session:
                pending_member = session.get(User, pending.user_id)
            monkeypatch.setitem(app.dependency_overrides, get_current_user, lambda: pending_member)
            unprepared = await client.get(f"/api/v1/smarttag/prepare/{pending.id}")
            assert unprepared.status_code == 200 and unprepared.json()["ready"] is False
            search = await client.post(
                "/api/v1/flights/search",
                json={
                    "origin": "HKG",
                    "destination": "NRT",
                    "departure_date": "2026-11-15",
                    "trip_type": "ONE_WAY",
                },
            )
            assert search.status_code == 200, search.text
            assert search.json()["outbound"][0]["cabins"]["BUSINESS"]["seats_available"] > 0
    finally:
        await engine.dispose()
