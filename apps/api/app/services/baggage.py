"""Baggage milestone helpers shared by IoT taps, app sync, and staff scans."""

from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.baggage import BaggageEvent, Tag

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
    status = normalize_status(event_type)
    if status in MILESTONES:
        tag.tag_status = status
    event = BaggageEvent(
        tag_id=tag.id,
        booking_id=booking_id or tag.booking_id,
        event_type=status,
        location_code=location_code,
        station_name=station_name,
        reader_id=reader_id,
        scanner_type=scanner_type,
        notes=notes,
    )
    db.add(event)
    return event
