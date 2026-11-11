from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class TripCard(BaseModel):
    booking_id: UUID
    pnr: str
    flight_number: str
    origin_code: str
    destination_code: str
    departure_time: datetime
    arrival_time: datetime
    terminal: str | None
    gate: str | None
    booking_status: str
    checkin_status: bool
    allowed_bags: int
    selected_bags: int
    smarttag_ready: bool


class AddTripRequest(BaseModel):
    pnr: str = Field(..., min_length=5, max_length=10)
    last_name: str = Field(..., min_length=1, max_length=100)
