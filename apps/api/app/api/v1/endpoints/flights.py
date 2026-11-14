from datetime import UTC, date, datetime, time, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.flight import Flight
from app.schemas.flight import (
    CabinAvailability,
    FlightOption,
    FlightSearchRequest,
    FlightSearchResponse,
)

router = APIRouter(tags=["flights"])


def _option(flight: Flight) -> FlightOption:
    return FlightOption(
        id=flight.id,
        flight_number=flight.flight_number,
        origin_code=flight.origin,
        destination_code=flight.destination,
        departure_time=flight.departure_time,
        arrival_time=flight.arrival_time,
        terminal=flight.terminal,
        gate=flight.gate,
        aircraft=flight.aircraft,
        is_connecting=flight.is_connecting,
        connecting_carrier=flight.connecting_carrier,
        cabins={
            name: CabinAvailability(**values) for name, values in flight.cabins.items()
        },
    )


async def _search(
    db: AsyncSession, origin: str, destination: str, day: date | None
) -> list[FlightOption]:
    stmt = (
        select(Flight)
        .where(Flight.origin == origin.upper(), Flight.destination == destination.upper())
        .order_by(Flight.departure_time)
    )
    if day is not None:
        start = datetime.combine(day, time.min, tzinfo=UTC)
        stmt = stmt.where(
            Flight.departure_time >= start, Flight.departure_time < start + timedelta(days=1)
        )
    return [_option(flight) for flight in (await db.scalars(stmt)).all()]


@router.post("/search", response_model=FlightSearchResponse)
async def search_flights(
    payload: FlightSearchRequest, db: AsyncSession = Depends(get_db)
) -> FlightSearchResponse:
    if payload.trip_type == "MULTI_CITY":
        multi_city = [
            await _search(db, leg.origin, leg.destination, leg.departure_date)
            for leg in payload.legs
        ]
        return FlightSearchResponse(trip_type=payload.trip_type, multi_city=multi_city)

    # The request validator guarantees these for ONE_WAY and RETURN.
    assert payload.origin and payload.destination and payload.departure_date
    outbound = await _search(
        db, payload.origin, payload.destination, payload.departure_date
    )

    return_flights: list[FlightOption] = []
    if payload.trip_type == "RETURN":
        assert payload.return_date
        return_flights = await _search(
            db, payload.destination, payload.origin, payload.return_date
        )

    return FlightSearchResponse(
        trip_type=payload.trip_type, outbound=outbound, return_flights=return_flights
    )
