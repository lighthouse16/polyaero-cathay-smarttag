from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class BaggageBase(BaseModel):
    passenger_name: str = Field(..., min_length=1, max_length=255)
    flight_number: str = Field(..., min_length=1, max_length=20)
    departure_airport: str = Field(..., min_length=3, max_length=3)
    arrival_airport: str = Field(..., min_length=3, max_length=3)
    departure_time: datetime
    seat_number: str | None = Field(None, max_length=10)
    tag_id: UUID | None = None


class BaggageCreate(BaggageBase):
    pass


class BaggageUpdate(BaseModel):
    passenger_name: str | None = Field(None, min_length=1, max_length=255)
    flight_number: str | None = Field(None, min_length=1, max_length=20)
    departure_airport: str | None = Field(None, min_length=3, max_length=3)
    arrival_airport: str | None = Field(None, min_length=3, max_length=3)
    departure_time: datetime | None = None
    seat_number: str | None = Field(None, max_length=10)
    tag_id: UUID | None = None
    status: str | None = Field(None, max_length=50)


class BaggageRead(BaggageBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    status: str
    created_at: datetime
    updated_at: datetime
