from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class BookingBase(BaseModel):
    pnr: str = Field(..., min_length=5, max_length=10)
    flight_number: str = Field(..., max_length=10)
    origin: str = Field(..., min_length=3, max_length=3)
    destination: str = Field(..., min_length=3, max_length=3)
    departure_date: datetime
    return_date: datetime | None = None
    cabin_class: str = Field("Economy", max_length=30)
    passenger_count: int = Field(1, ge=1, le=9)
    booking_status: str = Field("CONFIRMED", max_length=30)


class BookingCreate(BookingBase):
    pass


class BookingRead(BookingBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime


class LinkTagRequest(BaseModel):
    pnr: str = Field(..., min_length=5, max_length=10)
    tag_id: UUID
