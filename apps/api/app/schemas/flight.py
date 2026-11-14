from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

CabinClass = Literal["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"]
TripType = Literal["RETURN", "ONE_WAY", "MULTI_CITY"]


class CabinAvailability(BaseModel):
    seats_available: int
    price: float


class FlightOption(BaseModel):
    id: UUID
    flight_number: str
    origin_code: str
    destination_code: str
    departure_time: datetime
    arrival_time: datetime
    terminal: str | None
    gate: str | None
    aircraft: str | None
    is_connecting: bool
    connecting_carrier: str | None
    cabins: dict[str, CabinAvailability]


class FlightLegRequest(BaseModel):
    origin: str = Field(..., min_length=3, max_length=3)
    destination: str = Field(..., min_length=3, max_length=3)
    departure_date: date


class FlightSearchRequest(BaseModel):
    origin: str | None = Field(None, min_length=3, max_length=3)
    destination: str | None = Field(None, min_length=3, max_length=3)
    departure_date: date | None = None
    return_date: date | None = None
    trip_type: TripType = "ONE_WAY"
    cabin_class: CabinClass = "ECONOMY"
    passenger_count: int = Field(1, ge=1, le=9)
    legs: list[FlightLegRequest] = Field(default_factory=list)

    @model_validator(mode="after")
    def check_trip_shape(self) -> "FlightSearchRequest":
        if self.trip_type == "MULTI_CITY":
            if not self.legs:
                raise ValueError("legs is required for MULTI_CITY")
            return self
        if not (self.origin and self.destination and self.departure_date):
            raise ValueError("origin, destination and departure_date are required")
        if self.trip_type == "RETURN" and self.return_date is None:
            raise ValueError("return_date is required for RETURN")
        return self


class FlightSearchResponse(BaseModel):
    trip_type: str
    outbound: list[FlightOption] = Field(default_factory=list)
    return_flights: list[FlightOption] = Field(
        default_factory=list, serialization_alias="return"
    )
    multi_city: list[list[FlightOption]] = Field(default_factory=list)
