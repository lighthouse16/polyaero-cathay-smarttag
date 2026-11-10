from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class FlightRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    flight_number: str
    origin: str
    destination: str
    departure_time: datetime
    arrival_time: datetime
    aircraft: str | None
