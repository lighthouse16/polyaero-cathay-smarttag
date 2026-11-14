"""Baggage milestone helpers shared by IoT taps, app sync, and staff scans."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.baggage import Baggage, BaggageEvent, Tag
from app.models.booking import Booking
from app.models.flight import Flight

# SYNCHRONIZED / TAG_TAPPED are events, not baggage milestones.
MILESTONES = {
    "CHECKED_IN",
    "TAGGED",
    "LOADED",
    "IN_TRANSIT",
    "ARRIVED",
    "ON_CAROUSEL",
    "COLLECTED",
    "MISROUTED",
    "MISSING",
    "RECOVERY_IN_PROGRESS",
}
EVENT_TYPES = MILESTONES | {"SYNCHRONIZED", "TAG_TAPPED"}

RUSH_STATUSES = {"MISROUTED", "MISSING", "RECOVERY_IN_PROGRESS"}

BANNERS = {
    "UNLINKED": "AWAITING SYNC",
    "CHECKED_IN": "CHECKED IN",
    "TAGGED": "TAG SYNCED",
    "LOADED": "LOADED",
    "IN_TRANSIT": "IN TRANSIT",
    "ARRIVED": "ARRIVED",
    "ON_CAROUSEL": "ON CAROUSEL",
    "COLLECTED": "COLLECTED",
    "MISROUTED": "MISROUTED - REROUTING",
    "MISSING": "RECOVERY IN PROCESS",
    "RECOVERY_IN_PROGRESS": "RECOVERY IN PROCESS",
    "SYNCHRONIZED": "SYNCHRONIZED",
    "TAG_TAPPED": "TAG TAPPED",
}


def normalize_status(value: str) -> str:
    status = value.strip().upper()
    alias = {
        "PRIORITY_TRANSFER": "MISROUTED",
        "CLAIMED": "COLLECTED",
    }
    status = alias.get(status, status)
    if status not in EVENT_TYPES:
        raise ValueError(f"Unknown baggage status: {value}")
    return status


def banner_for(status: str) -> str:
    return BANNERS.get(status.upper(), status.upper().replace("_", " "))


def is_rush(status: str) -> bool:
    return status.upper() in RUSH_STATUSES


async def find_tag(db: AsyncSession, identifier: str) -> Tag | None:
    value = identifier.strip()
    tag = await db.scalar(
        select(Tag).where(
            or_(
                func.upper(Tag.tag_code) == value.upper(),
                Tag.bar_code_payload == value,
                Tag.baggage_barcode == value,
            )
        )
    )
    if tag is not None:
        return tag
    try:
        tag_id = UUID(value)
    except ValueError:
        return None
    return await db.get(Tag, tag_id)


async def record_event(
    db: AsyncSession,
    tag: Tag,
    event_type: str,
    *,
    booking_id: UUID | None = None,
    location_code: str | None = None,
    station_name: str | None = None,
    reader_id: str | None = None,
    scanner_type: str = "NFC_TAP",
    notes: str | None = None,
) -> BaggageEvent:
    from app.services.dashboard_baggage import ensure_baggage

    status = normalize_status(event_type)
<<<<<<< HEAD
    baggage = await db.scalar(select(Baggage).where(Baggage.tag_id == tag.id))
    if baggage is not None and tag.booking_id is not None:
        booking = await db.get(Booking, tag.booking_id)
        if booking is not None and baggage.flight_id != booking.flight_id:
            flight = await db.get(Flight, booking.flight_id)
            if flight is not None:
                baggage.flight_id = flight.id
                baggage.status = flight.initial_status
    if status in MILESTONES:
        tag.tag_status = status
        if baggage is not None:
            baggage.status = status
=======
    bag = await ensure_baggage(db, tag)
    now = datetime.now(UTC)
    if status in MILESTONES:
        tag.tag_status = status
        if bag is not None:
            bag.status = status
            bag.operational_data = {
                key: value for key, value in (bag.operational_data or {}).items()
                if key != "eink_banner"
            }
    tag.updated_at = now
    if bag is not None:
        bag.updated_at = now
>>>>>>> origin/main
    event = BaggageEvent(
        tag_id=tag.id,
        booking_id=booking_id or tag.booking_id,
        event_type=status,
        location_code=location_code,
        station_name=station_name,
        reader_id=reader_id,
        scanner_type=scanner_type,
        notes=notes,
        created_at=now,
    )
    db.add(event)
    return event
