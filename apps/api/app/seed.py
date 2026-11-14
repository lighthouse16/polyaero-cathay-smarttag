"""Preview or insert linked synthetic API data: python -m app.seed [--apply]."""

import argparse
import asyncio
import json
import os
from datetime import UTC, date, datetime, time, timedelta
from typing import Any
from uuid import NAMESPACE_URL, UUID, uuid5

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.database import Base, async_session_maker, engine
from app.models.auth import User
from app.models.baggage import Baggage, BaggageEvent, Tag
from app.models.booking import Booking
from app.models.flight import Flight
from app.services.auth import hash_password
from app.services.smarttag import build_barcode, build_ndef_record, hash_payload

SeedData = dict[type[Base], list[dict[str, Any]]]


def seed_id(key: str) -> UUID:
    return uuid5(NAMESPACE_URL, f"polyaero-cathay-smarttag:seed:v1:{key}")


def build_seed_data(day: date, password: str | None = None) -> SeedData:
    if password is not None and (len(password) < 8 or len(password.encode()) > 72):
        raise ValueError(
            "SEED_USER_PASSWORD must have at least 8 characters and at most 72 UTF-8 bytes"
        )

    anchor = datetime.combine(day, time.min, tzinfo=UTC)
    data: SeedData = {model: [] for model in (User, Flight, Booking, Tag, Baggage, BaggageEvent)}
    for i, tier in enumerate(("GREEN", "SILVER", "GOLD", "DIAMOND"), 1):
        data[User].append(
            {
                "id": seed_id(f"member/{i}"),
                "email": f"seed.passenger.{i}@example.com",
                "membership_number": f"990000000{i}",
                "title": "Mx",
                "family_name": f"SEED{i}",
                "given_names": f"DEMO {i}",
                "membership_tier": tier,
                "status_points": (i - 1) * 400,
                "communication_prefs": {
                    "email_notifications": False,
                    "sms_notifications": False,
                    "promotional_offers": False,
                },
                "password_hash": hash_password(password) if password is not None else None,
                "is_active": True,
                "is_verified": True,
                "created_at": anchor - timedelta(days=30),
                "updated_at": anchor,
            }
        )

    schedules = (
        ("CX548", "HKG", "NRT", 32, 245),
        ("CX549", "NRT", "HKG", 178, 280),
        ("CX255", "HKG", "NKG", 1, 150),
        ("CX256", "NKG", "HKG", 133, 150),
        ("CX888", "HKG", "YVR", -32, 720),
        ("CX889", "YVR", "HKG", -3, 840),
        ("CX251", "HKG", "LHR", 1, 780),
        ("CX250", "LHR", "HKG", 86, 720),
    )
    for i, (number, origin, destination, hours, duration) in enumerate(schedules):
        departure = anchor + timedelta(hours=hours)
        data[Flight].append(
            {
                "id": seed_id(f"{day}/flight/{i}"),
                "flight_number": number,
                "origin": origin,
                "destination": destination,
                "departure_time": departure,
                "arrival_time": departure + timedelta(minutes=duration),
                "terminal": "1",
                "gate": str(20 + i),
                "aircraft": "Airbus A330-300"
                if destination == "NKG" or origin == "NKG"
                else "Boeing 777-300ER",
                "is_connecting": False,
                "cabins": {
                    cabin: {"seats_available": seats, "price": price}
                    for cabin, seats, price in (
                        ("ECONOMY", 90, 2400.0),
                        ("PREMIUM_ECONOMY", 12, 4800.0),
                        ("BUSINESS", 8, 9600.0),
                        ("FIRST", 0, 18000.0),
                    )
                },
                "created_at": anchor - timedelta(days=14),
            }
        )

    normal_path = (
        "CHECKED_IN",
        "TAGGED",
        "LOADED",
        "IN_TRANSIT",
        "ARRIVED",
        "ON_CAROUSEL",
        "COLLECTED",
    )
    scenarios = [(status, normal_path[: i + 1]) for i, status in enumerate(normal_path)]
    scenarios += [
        ("MISROUTED", normal_path[:3] + ("MISROUTED",)),
        ("MISSING", normal_path[:3] + ("MISSING",)),
        ("RECOVERY_IN_PROGRESS", normal_path[:3] + ("MISSING", "RECOVERY_IN_PROGRESS")),
    ]
    flight_indices = (0, 0, 2, 5, 4, 4, 4, 6, 6, 6, 1, 3)
    cabins = ("ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST")
    for i in range(12):
        user = data[User][i % 4]
        flight = data[Flight][flight_indices[i]]
        booking = {
            "id": seed_id(f"{day}/booking/{i}"),
            "user_id": user["id"],
            "flight_id": flight["id"],
            "pnr": f"SD{day:%y%m%d}{i:02d}",
            "booking_status": "PAST" if i in (4, 5, 6) else "CANCELLED" if i == 11 else "UPCOMING",
            "checkin_status": i < 10,
            "allowed_bags": 2,
            "selected_bags": 0 if i == 11 else 1,
            "cabin_class": cabins[i % 3],
            "created_at": anchor - timedelta(days=14),
            "updated_at": anchor,
        }
        data[Booking].append(booking)
        tag_id = seed_id(f"{day}/tag/{i}")
        tag = {
            "id": tag_id,
            "tag_code": f"SEED-{day:%Y%m%d}-{i:02d}",
            "is_active": i != 11,
            "firmware_version": "seed-v1",
            "hardware_revision": "SIMULATED",
            "is_simulated": True,
            "tag_status": "UNLINKED",
            "sync_state": "PREPARE",
            "user_id": None,
            "booking_id": None,
            "pnr": None,
            "baggage_barcode": None,
            "bar_code_payload": None,
            "nfc_payload_hash": None,
            "weight_kg": None,
            "last_seen_at": None,
            "last_synced_at": None,
            "created_at": anchor - timedelta(days=14),
            "updated_at": anchor,
        }
        data[Tag].append(tag)
        if i >= 10:
            continue

        status, path = scenarios[i]
        history = list(path)
        if "TAGGED" in history:
            history.insert(history.index("TAGGED") + 1, "SYNCHRONIZED")
        first = min(
            anchor - timedelta(hours=2, minutes=20 * (len(history) - 1)),
            flight["departure_time"] - timedelta(hours=3),
        )
        timestamps = []
        for j, event_type in enumerate(history):
            at = first + timedelta(minutes=20 * j)
            if event_type == "IN_TRANSIT":
                at = flight["departure_time"] + timedelta(hours=1)
            elif event_type in {"ARRIVED", "ON_CAROUSEL", "COLLECTED"}:
                minutes = {"ARRIVED": 20, "ON_CAROUSEL": 40, "COLLECTED": 60}[event_type]
                at = flight["arrival_time"] + timedelta(minutes=minutes)
            timestamps.append(at)
        latest = timestamps[-1]
        barcode = build_barcode(tag_id)
        tag.update(
            {
                "user_id": user["id"],
                "booking_id": booking["id"],
                "pnr": booking["pnr"],
                "baggage_barcode": barcode,
                "tag_status": status,
                "last_seen_at": latest,
                "weight_kg": 18.0 + i,
                "updated_at": latest,
            }
        )
        if "SYNCHRONIZED" in history:
            synced_at = timestamps[history.index("SYNCHRONIZED")]
            record = json.loads(
                build_ndef_record(Tag(**tag), Booking(**booking), Flight(**flight), barcode)
            )
            record["at"] = synced_at.isoformat()
            tag.update(
                {
                    "bar_code_payload": barcode,
                    "sync_state": "READY",
                    "last_synced_at": synced_at,
                    "nfc_payload_hash": hash_payload(
                        json.dumps(record, separators=(",", ":"), sort_keys=True)
                    ),
                }
            )
        data[Baggage].append(
            {
                "id": seed_id(f"{day}/baggage/{i}"),
                "tag_id": tag_id,
                "passenger_name": f"{user['family_name']}/{user['given_names']}",
                "flight_number": flight["flight_number"],
                "departure_airport": flight["origin"],
                "arrival_airport": flight["destination"],
                "departure_time": flight["departure_time"],
                "seat_number": f"{12 + i}A",
                "status": status,
                "created_at": timestamps[0],
                "updated_at": latest,
            }
        )
        for j, event_type in enumerate(history):
            destination_scan = event_type in {"ARRIVED", "ON_CAROUSEL", "COLLECTED"}
            airport = flight["destination"] if destination_scan else flight["origin"]
            scanner = "APP" if event_type in {"TAGGED", "SYNCHRONIZED"} else "OPTICAL_BARCODE"
            data[BaggageEvent].append(
                {
                    "id": seed_id(f"{day}/event/{i}/{j}"),
                    "tag_id": tag_id,
                    "booking_id": booking["id"],
                    "event_type": event_type,
                    "location_code": f"{airport}-SEED-{event_type}",
                    "station_name": f"Seed demo {airport} baggage operations",
                    "reader_id": f"SEED-{scanner}",
                    "scanner_type": scanner,
                    "notes": f"Synthetic {day} snapshot: {status}. No physical NFC scan or refresh performed.",
                    "created_at": timestamps[j],
                }
            )
    return data


def seed_database(session: Session, day: date, password: str | None = None) -> dict[str, int]:
    """Insert only; the caller owns the transaction. Other unique-key conflicts must fail."""
    counts = {}
    for model, rows in build_seed_data(day, password).items():
        statement = (
            insert(model)
            .values(rows)
            .on_conflict_do_nothing(index_elements=["id"])
            .returning(model.__table__.c.id)
        )
        counts[model.__tablename__] = len(session.scalars(statement).all())
    return counts


async def apply_seed(day: date, password: str | None = None) -> dict[str, int]:
    # Do not log SQL parameters containing demo password hashes.
    engine.echo = False
    try:
        async with async_session_maker.begin() as session:
            return await session.run_sync(seed_database, day, password)
    finally:
        await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--date",
        type=date.fromisoformat,
        default=datetime.now(UTC).date(),
        help="UTC snapshot date (YYYY-MM-DD); fixes the dataset identity",
    )
    parser.add_argument(
        "--apply", action="store_true", help="Write to DATABASE_URL; otherwise preview only"
    )
    args = parser.parse_args()
    for model, rows in build_seed_data(args.date).items():
        print(f"{model.__tablename__}: {len(rows)} planned")
    print("No refresh tokens, verification codes, or passkeys will be seeded.")
    print("Dashboard /baggage still uses in-memory demo data, not these database rows.")
    if not args.apply:
        print("Preview only; no database connection. Add --apply to insert.")
        return
    print(f"Target: {engine.url.host}:{engine.url.port or 5432}/{engine.url.database}")
    # psycopg's async driver requires a selector loop on Windows.
    with asyncio.Runner(loop_factory=asyncio.SelectorEventLoop) as runner:
        counts = runner.run(apply_seed(args.date, os.environ.get("SEED_USER_PASSWORD")))
    print(f"Committed new rows: {counts}. Existing rows were not updated or deleted.")


if __name__ == "__main__":
    main()
