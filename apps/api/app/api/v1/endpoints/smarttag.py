from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.auth import User
from app.models.baggage import Tag
from app.models.booking import Booking
from app.models.flight import Flight
from app.schemas.smarttag import (
    SmartTagPrepare,
    SyncPayloadRequest,
    SyncPayloadResponse,
)
from app.services.baggage import record_event
from app.services.mqtt import publish_display
from app.services.smarttag import (
    build_barcode,
    build_display_payload,
    build_ndef_record,
    hash_payload,
)

router = APIRouter(prefix="/smarttag", tags=["smarttag"])


async def _owned_booking(
    db: AsyncSession, user: User, booking_id: UUID
) -> tuple[Booking, Flight]:
    booking = await db.scalar(
        select(Booking).where(Booking.id == booking_id, Booking.user_id == user.id)
    )
    if booking is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    flight = await db.scalar(select(Flight).where(Flight.id == booking.flight_id))
    if flight is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Itinerary not found")
    return booking, flight


async def _bound_tag(db: AsyncSession, booking: Booking) -> Tag | None:
    return await db.scalar(
        select(Tag)
        .where(Tag.pnr == booking.pnr, Tag.is_active.is_(True))
        .order_by(Tag.last_synced_at.desc().nulls_last())
        .limit(1)
    )


@router.get("/prepare/{booking_id}", response_model=SmartTagPrepare)
async def prepare(
    booking_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SmartTagPrepare:
    booking, _ = await _owned_booking(db, current_user, booking_id)
    tag = await _bound_tag(db, booking)

    return SmartTagPrepare(
        booking_id=booking.id,
        pnr=booking.pnr,
        demo_checkin_completed=booking.checkin_status,
        allowed_bags=booking.allowed_bags,
        selected_bags=booking.selected_bags,
        smarttag_available=tag is not None,
        tag_id=tag.id if tag else None,
        sync_state=tag.sync_state if tag else None,
        ready=booking.checkin_status and tag is not None,
    )


async def _resolve_tag(
    db: AsyncSession, booking: Booking, hardware_nfc_id: str | None
) -> Tag:
    if hardware_nfc_id:
        tag = await db.scalar(
            select(Tag).where(Tag.tag_code == hardware_nfc_id, Tag.is_active.is_(True))
        )
        if tag is None:
            try:
                tag = await db.scalar(
                    select(Tag).where(
                        Tag.id == UUID(hardware_nfc_id), Tag.is_active.is_(True)
                    )
                )
            except ValueError:
                tag = None
    else:
        tag = await _bound_tag(db, booking)

    if tag is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No active SmartTag bound to this booking",
        )

    # One tag per booking: release any other tag already pointing at this PNR.
    await db.execute(
        update(Tag)
        .where(Tag.pnr == booking.pnr, Tag.id != tag.id)
        .values(pnr=None, user_id=None, booking_id=None, tag_status="UNLINKED")
    )
    return tag


async def _sync(
    db: AsyncSession, user: User, payload: SyncPayloadRequest, is_simulated: bool
) -> SyncPayloadResponse:
    booking, flight = await _owned_booking(db, user, payload.booking_id)
    if not booking.checkin_status:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Check-in not completed"
        )

    tag = await _resolve_tag(db, booking, payload.hardware_nfc_id)
    barcode = build_barcode(tag.id)
    record = build_ndef_record(tag, booking, flight, barcode)
    display = build_display_payload(tag, booking, flight, user, barcode)

    tag.user_id = user.id
    tag.pnr = booking.pnr
    tag.booking_id = booking.id
    tag.bar_code_payload = barcode
    tag.baggage_barcode = barcode
    tag.nfc_payload_hash = hash_payload(record)
    tag.sync_state = "READY"
    tag.is_simulated = is_simulated
    tag.last_synced_at = datetime.now(UTC)
    await record_event(
        db,
        tag,
        "SYNCHRONIZED",
        location_code=payload.hardware_nfc_id or "MOBILE-APP",
        station_name="Cathay App SmartTag Sync",
        scanner_type="APP",
        notes="Simulated sync" if is_simulated else "NFC payload written",
    )
    await db.commit()
    await db.refresh(tag)

    published = await publish_display(tag.id, display)

    return SyncPayloadResponse(
        tag_id=tag.id,
        booking_id=booking.id,
        sync_state=tag.sync_state,
        is_simulated=tag.is_simulated,
        ndef_record=record,
        nfc_payload_hash=tag.nfc_payload_hash,
        bar_code_payload=barcode,
        display_payload=display,
        mqtt_published=published,
    )


@router.post("/sync/payload", response_model=SyncPayloadResponse)
async def sync_payload(
    payload: SyncPayloadRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SyncPayloadResponse:
    return await _sync(db, current_user, payload, is_simulated=False)


@router.post("/sync/simulation", response_model=SyncPayloadResponse)
async def sync_simulation(
    payload: SyncPayloadRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SyncPayloadResponse:
    return await _sync(db, current_user, payload, is_simulated=True)
