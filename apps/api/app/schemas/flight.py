from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

CabinClass = Literal["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"]
TripType = Literal["RETURN", "ONE_WAY", "MULTI_CITY"]
OperationalStatus = Literal[
    "UNKNOWN", "SCHEDULED", "DELAYED", "BOARDING", "DEPARTED", "ARRIVED", "CANCELLED"
]
InitialBaggageStatus = Literal["AWAITING_SYNC", "CHECKED_IN"]


class FlightStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    operational_status: OperationalStatus
    weather_severity: int = Field(default=2, ge=1, le=5)
    load_factor_pct: float = Field(default=86.0, ge=0, le=100, allow_inf_nan=False)
    airport_congestion: int = Field(default=2, ge=1, le=5)
    initial_status: InitialBaggageStatus = "AWAITING_SYNC"
    estimated_departure_time: AwareDatetime | None = None
    estimated_arrival_time: AwareDatetime | None = None
    actual_departure_time: AwareDatetime | None = None
    actual_arrival_time: AwareDatetime | None = None
    terminal: str | None = Field(None, min_length=1, max_length=10)
    gate: str | None = Field(None, min_length=1, max_length=10)

    @model_validator(mode="after")
    def chronological_times(self) -> "FlightStatusUpdate":
        for departure, arrival in (
            (self.estimated_departure_time, self.estimated_arrival_time),
            (self.actual_departure_time, self.actual_arrival_time),
        ):
            if departure is not None and arrival is not None and arrival <= departure:
                raise ValueError("Arrival must be later than departure")
        return self


class CabinAvailability(BaseModel):
    seats_available: int
    price: float


class FlightStatusRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    flight_number: str
    origin: str
    destination: str
    departure_time: datetime
    arrival_time: datetime
    operational_status: OperationalStatus
    weather_severity: int
    load_factor_pct: float
    airport_congestion: int
    initial_status: InitialBaggageStatus
    aircraft: str | None
    is_connecting: bool
    connecting_carrier: str | None
    cabins: dict[str, CabinAvailability]
    estimated_departure_time: datetime | None
    estimated_arrival_time: datetime | None
    actual_departure_time: datetime | None
    actual_arrival_time: datetime | None
    terminal: str | None
    gate: str | None
    status_reported_at: datetime | None
    source: Literal["STAFF_REPORTED_DATABASE"] = "STAFF_REPORTED_DATABASE"


class FlightOption(BaseModel):
    id: UUID
    flight_number: str
    origin_code: str
    destination_code: str
    departure_time: datetime
    arrival_time: datetime
    weather_severity: int
    load_factor_pct: float
    airport_congestion: int
    initial_status: InitialBaggageStatus
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
    return_flights: list[FlightOption] = Field(default_factory=list, serialization_alias="return")
    multi_city: list[list[FlightOption]] = Field(default_factory=list)
