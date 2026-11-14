from datetime import UTC, date, datetime, time, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import require_flight_staff_key
from app.models.flight import Flight
from app.schemas.flight import (
    CabinAvailability,
    FlightOption,
    FlightSearchRequest,
    FlightSearchResponse,
    FlightStatusRead,
    FlightStatusUpdate,
)

router = APIRouter(tags=["flights"])


@router.get("/status", response_model=list[FlightStatusRead])
async def flight_status(
    flight_number: str = Query(min_length=1, max_length=10),
    departure_date: date = Query(),
    db: AsyncSession = Depends(get_db),
) -> list[Flight]:
    start = datetime.combine(departure_date, time.min, tzinfo=UTC)
    rows = await db.scalars(
        select(Flight)
        .where(
            func.upper(Flight.flight_number) == flight_number.strip().upper(),
            Flight.departure_time >= start,
            Flight.departure_time < start + timedelta(days=1),
        )
        .order_by(Flight.departure_time, Flight.id)
    )
    return list(rows.all())


@router.patch(
    "/{flight_id}/status",
    response_model=FlightStatusRead,
    dependencies=[Depends(require_flight_staff_key)],
)
async def update_flight_status(
    flight_id: UUID,
    payload: FlightStatusUpdate,
    db: AsyncSession = Depends(get_db),
) -> Flight:
    flight = await db.scalar(select(Flight).where(Flight.id == flight_id).with_for_update())
    if flight is None:
        raise HTTPException(status_code=404, detail="Flight not found")
    changes = payload.model_dump(exclude_unset=True)
    merged = {name: getattr(flight, name) for name in FlightStatusUpdate.model_fields}
    try:
        FlightStatusUpdate.model_validate(merged | changes)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail="Arrival must be later than departure") from exc
    for name, value in changes.items():
        setattr(flight, name, value)
    flight.status_reported_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(flight)
    return flight


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
        cabins={name: CabinAvailability(**values) for name, values in flight.cabins.items()},
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
    outbound = await _search(db, payload.origin, payload.destination, payload.departure_date)

    return_flights: list[FlightOption] = []
    if payload.trip_type == "RETURN":
        assert payload.return_date
        return_flights = await _search(db, payload.destination, payload.origin, payload.return_date)

    return FlightSearchResponse(
        trip_type=payload.trip_type, outbound=outbound, return_flights=return_flights
    )
