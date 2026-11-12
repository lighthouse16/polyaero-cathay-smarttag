from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.auth import User
from app.models.baggage import Tag
from app.models.booking import Booking
from app.models.flight import Flight
from app.schemas.booking import BookingStatus
from app.schemas.trip import AddTripRequest, TripCard

router = APIRouter(prefix="/trips", tags=["trips"])


async def _flight(db: AsyncSession, booking: Booking) -> Flight:
    flight = await db.scalar(select(Flight).where(Flight.id == booking.flight_id))
    if flight is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Itinerary not found")
    return flight


async def _card(db: AsyncSession, booking: Booking, flight: Flight) -> TripCard:
    bound = await db.scalar(
        select(Tag.id)
        .where(Tag.pnr == booking.pnr, Tag.is_active.is_(True))
        .limit(1)
    )
    return TripCard(
        booking_id=booking.id,
        pnr=booking.pnr,
        flight_number=flight.flight_number,
        origin_code=flight.origin,
        destination_code=flight.destination,
        departure_time=flight.departure_time,
        arrival_time=flight.arrival_time,
        terminal=flight.terminal,
        gate=flight.gate,
        booking_status=booking.booking_status,
        checkin_status=booking.checkin_status,
        allowed_bags=booking.allowed_bags,
        selected_bags=booking.selected_bags,
        smarttag_ready=bound is not None,
    )


@router.get("", response_model=list[TripCard])
async def list_trips(
    tab: BookingStatus = "UPCOMING",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[TripCard]:
    rows = (
        await db.execute(
            select(Booking, Flight)
            .join(Flight, Flight.id == Booking.flight_id)
            .where(Booking.user_id == current_user.id, Booking.booking_status == tab)
            .order_by(Flight.departure_time)
        )
    ).all()
    return [await _card(db, booking, flight) for booking, flight in rows]


@router.post("/add", response_model=TripCard)
async def add_trip(
    trip_in: AddTripRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TripCard:
    """Import a booking by PNR + surname, airline-style."""
    booking = await db.scalar(select(Booking).where(Booking.pnr == trip_in.pnr.upper()))
    surname = (current_user.family_name or "").strip().lower()
    if booking is None or surname != trip_in.last_name.strip().lower():
        # Deliberately identical response so PNRs cannot be probed.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    if booking.user_id is not None and booking.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Booking already linked to a member"
        )

    booking.user_id = current_user.id
    await db.commit()
    await db.refresh(booking)
    return await _card(db, booking, await _flight(db, booking))
