from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.flight import FlightStatusRead

BookingStatus = Literal["UPCOMING", "PAST", "CANCELLED"]


class BookingCreate(BaseModel):
    pnr: str = Field(..., min_length=5, max_length=10)
    flight_id: UUID
    booking_status: BookingStatus = "UPCOMING"
    checkin_status: bool = False
    allowed_bags: int = Field(2, ge=0, le=9)
    selected_bags: int = Field(1, ge=0, le=9)
    cabin_class: str = Field("ECONOMY", max_length=20)


class BookingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID | None
    flight_id: UUID
    pnr: str
    booking_status: str
    checkin_status: bool
    allowed_bags: int
    selected_bags: int
    cabin_class: str
    created_at: datetime
    updated_at: datetime


class LinkTagRequest(BaseModel):
    pnr: str = Field(..., min_length=5, max_length=10)
    tag_id: UUID


class PrototypeBoardingPass(BaseModel):
    booking_id: UUID
    pnr: str
    passenger_name: str
    cabin_class: str
    seat_number: None = None
    flight: FlightStatusRead
    generated_at: datetime
    valid_for_boarding: Literal[False] = False
    notice: Literal["PROTOTYPE - NOT VALID FOR BOARDING"] = "PROTOTYPE - NOT VALID FOR BOARDING"
