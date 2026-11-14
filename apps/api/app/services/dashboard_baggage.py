"""Database-backed baggage records in the staff dashboard response shape."""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auth import User
from app.models.baggage import Baggage, BaggageEvent, Tag
from app.models.booking import Booking
from app.models.flight import Flight
from app.services.baggage import banner_for, find_tag, is_rush


async def ensure_baggage(db: AsyncSession, tag: Tag) -> Baggage | None:
    # Serialize creation on the tag so concurrent taps cannot create two bags.
    await db.execute(select(Tag.id).where(Tag.id == tag.id).with_for_update())
    bag = await db.scalar(select(Baggage).where(Baggage.tag_id == tag.id))
    if bag is not None or tag.booking_id is None:
        return bag
    booking = await db.get(Booking, tag.booking_id)
    flight = await db.get(Flight, booking.flight_id) if booking else None
    if booking is None or flight is None:
        return None
    user = await db.get(User, booking.user_id) if booking.user_id else None
    bag = Baggage(
        tag_id=tag.id,
        passenger_name=f"{user.family_name or ''}/{user.given_names or ''}" if user else "",
        flight_number=flight.flight_number,
        departure_airport=flight.origin,
        arrival_airport=flight.destination,
        departure_time=flight.departure_time,
        status=tag.tag_status,
    )
    db.add(bag)
    await db.flush()
    return bag


async def find_baggage(
    db: AsyncSession, identifier: str, *, for_update: bool = False
) -> Baggage | None:
    tag = await find_tag(db, identifier)
    tag_id: UUID | None
    if tag:
        tag_id = tag.id
        statement = select(Baggage).where(Baggage.tag_id == tag.id)
    else:
        try:
            bag_id = UUID(identifier)
        except ValueError:
            return None
        statement = select(Baggage).where(Baggage.id == bag_id)
        tag_id = await db.scalar(select(Baggage.tag_id).where(Baggage.id == bag_id))
    if for_update:
        if tag_id is not None:
            await db.execute(select(Tag.id).where(Tag.id == tag_id).with_for_update())
        statement = statement.with_for_update().execution_options(populate_existing=True)
    return await db.scalar(statement)


def apply_assessment(bag: Baggage, assessment: Any, transfer_minutes: int) -> None:
    bag.operational_data = {
        **(bag.operational_data or {}),
        "risk_score": assessment.risk_score,
        "risk_level": assessment.risk_level,
        "risk_factors": assessment.factors,
        "passenger_risk_summary": assessment.passenger_summary,
        "predicted_arrival_time": assessment.predicted_arrival_time,
        "carousel_assigned": assessment.carousel_estimate,
        "model_version": assessment.model_version,
        "recommended_action": assessment.recommended_action,
        "connection_minutes": transfer_minutes,
    }
    bag.updated_at = datetime.now(UTC)


async def load_baggage(
    db: AsyncSession, bag_id: UUID | None = None
) -> list[dict[str, Any]]:
    statement = (
        select(Baggage, Tag, Booking, User)
        .outerjoin(Tag, Baggage.tag_id == Tag.id)
        .outerjoin(Booking, Tag.booking_id == Booking.id)
        .outerjoin(User, User.id == func.coalesce(Booking.user_id, Tag.user_id))
        .order_by(Baggage.created_at, Baggage.id)
    )
    if bag_id is not None:
        statement = statement.where(Baggage.id == bag_id)
    rows = (await db.execute(statement)).all()
    tag_ids = {tag.id for _, tag, _, _ in rows if tag is not None}
    events_by_tag: dict[UUID, list[dict[str, Any]]] = {}
    if tag_ids:
        event_rows = await db.scalars(
            select(BaggageEvent)
            .where(BaggageEvent.tag_id.in_(tag_ids))
            .order_by(BaggageEvent.created_at, BaggageEvent.id)
        )
        for event in event_rows:
            events_by_tag.setdefault(event.tag_id, []).append({
                "id": str(event.id),
                "event_type": event.event_type,
                "timestamp": event.created_at.isoformat(),
                "location_code": event.location_code,
                "station_name": event.station_name,
                "handled_by_staff_id": event.reader_id,
                "scanner_type": event.scanner_type,
                "notes": event.notes,
            })
    result = []
    for bag, tag, booking, user in rows:
        events = events_by_tag.get(tag.id, []) if tag else []
        location = next(
            (event["location_code"] for event in reversed(events) if event["location_code"]),
            None,
        )
        state = bag.operational_data or {}
        status = bag.status.upper()
        result.append({
            **state,
            "id": str(bag.id),
            "tag_number": (
                tag.bar_code_payload or tag.baggage_barcode or tag.tag_code
                if tag else str(bag.id)
            ),
            "tag_code": tag.tag_code if tag else None,
            "tag_interface": "SMARTTAG_EINK_EXCLUSIVE" if tag else None,
            "booking_reference": booking.pnr if booking else (tag.pnr if tag else None),
            "passenger_name": bag.passenger_name,
            "tier_status": user.membership_tier if user else None,
            "cabin_class": booking.cabin_class if booking else None,
            "flight_number": bag.flight_number,
            "departure_airport": bag.departure_airport,
            "arrival_airport": bag.arrival_airport,
            "departure_time": bag.departure_time.isoformat(),
            "seat_number": bag.seat_number,
            "weight_kg": tag.weight_kg if tag else None,
            "status": status,
            "last_known_location": location,
            "carousel_assigned": state.get("carousel_assigned"),
            "connection_minutes": state.get("connection_minutes"),
            "is_rush_bag": is_rush(status) or state.get("risk_level") in {
                "HIGH_PRIORITY", "ACTION_REQUIRED"
            },
            "risk_score": state.get("risk_score"),
            "risk_level": state.get("risk_level", "UNASSESSED"),
            "recommended_action": state.get("recommended_action"),
            "passenger_recovery_choice": state.get("passenger_recovery_choice"),
            "eink_banner": state.get("eink_banner") or banner_for(status),
            "updated_at": bag.updated_at.isoformat(),
            "events": events,
            "is_tag_synced": tag.sync_state == "READY" if tag else False,
        })
    return result
