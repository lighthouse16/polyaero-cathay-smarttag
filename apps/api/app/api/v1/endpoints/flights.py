from datetime import UTC, date, datetime, time, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.flight import Flight
from app.schemas.flight import FlightRead

router = APIRouter(tags=["flights"])


@router.get("/search", response_model=list[FlightRead])
async def search_flights(
    origin: str = Query(..., min_length=3, max_length=3),
    destination: str = Query(..., min_length=3, max_length=3),
    departure_date: date | None = None,
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
) -> list[Flight]:
    stmt = (
        select(Flight)
        .where(Flight.origin == origin.upper(), Flight.destination == destination.upper())
        .order_by(Flight.departure_time)
        .limit(limit)
    )
    if departure_date is not None:
        start = datetime.combine(departure_date, time.min, tzinfo=UTC)
        stmt = stmt.where(
            Flight.departure_time >= start, Flight.departure_time < start + timedelta(days=1)
        )

    return list((await db.scalars(stmt)).all())
