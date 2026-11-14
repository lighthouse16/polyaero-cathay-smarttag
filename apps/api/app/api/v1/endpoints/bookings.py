from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.auth import User
from app.models.baggage import Tag
from app.models.booking import Booking
from app.models.flight import Flight
from app.schemas.booking import BookingCreate, BookingRead, LinkTagRequest, PrototypeBoardingPass
from app.schemas.flight import FlightStatusRead
from app.services.baggage import record_event

router = APIRouter(tags=["bookings"])


@router.get("/{booking_id}/boarding-pass", response_model=PrototypeBoardingPass)
async def boarding_pass(
    booking_id: UUID,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PrototypeBoardingPass:
    response.headers["Cache-Control"] = "no-store"
    row = (
        await db.execute(
            select(Booking, Flight)
            .join(Flight, Flight.id == Booking.flight_id)
            .where(
                Booking.id == booking_id,
                Booking.user_id == current_user.id,
            )
        )
    ).one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Booking not found")
    booking, flight = row
    if not booking.checkin_status or booking.booking_status != "UPCOMING":
        raise HTTPException(status_code=409, detail="An upcoming checked-in booking is required")
    if flight.operational_status in {"CANCELLED", "DEPARTED", "ARRIVED"}:
        raise HTTPException(
            status_code=409, detail="This flight is no longer available for boarding"
        )
    return PrototypeBoardingPass(
        booking_id=booking.id,
        pnr=booking.pnr,
        passenger_name=" ".join(filter(None, (current_user.family_name, current_user.given_names))),
        cabin_class=booking.cabin_class,
        flight=FlightStatusRead.model_validate(flight),
        generated_at=datetime.now(UTC),
    )


@router.post("", response_model=BookingRead, status_code=status.HTTP_201_CREATED)
async def create_booking(
    booking_in: BookingCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Booking:
    pnr = booking_in.pnr.upper()
    if await db.scalar(select(Booking.id).where(Booking.pnr == pnr)):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Booking reference already exists"
        )
    if await db.scalar(select(Flight.id).where(Flight.id == booking_in.flight_id)) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flight not found")

    booking = Booking(
        user_id=current_user.id,
        pnr=pnr,
        **booking_in.model_dump(exclude={"pnr"}),
    )
    db.add(booking)
    await db.commit()
    await db.refresh(booking)
    return booking


@router.post("/link-tag", response_model=BookingRead)
async def link_tag(
    link_in: LinkTagRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Booking:
    """Bind a SmartTag to a member's booking. Rebinds silently if the tag is in use."""
    booking = await db.scalar(
        select(Booking).where(
            Booking.pnr == link_in.pnr.upper(), Booking.user_id == current_user.id
        )
    )
    if booking is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    tag = await db.scalar(select(Tag).where(Tag.id == link_in.tag_id))
    if tag is None or not tag.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")

    # One tag per booking: release any other tag already pointing at this PNR.
    await db.execute(
        update(Tag)
        .where(Tag.pnr == booking.pnr, Tag.id != tag.id)
        .values(pnr=None, user_id=None, booking_id=None, tag_status="UNLINKED")
    )
    tag.user_id = current_user.id
    tag.pnr = booking.pnr
    tag.booking_id = booking.id
    tag.tag_status = "CHECKED_IN"
    tag.last_synced_at = datetime.now(UTC)
    booking.checkin_status = True
    await record_event(
        db,
        tag,
        "CHECKED_IN",
        location_code="MOBILE-APP",
        station_name="Cathay App",
        scanner_type="APP",
        notes="SmartTag linked to booking",
    )
    await db.commit()
    await db.refresh(booking)
    return booking
