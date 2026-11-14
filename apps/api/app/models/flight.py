from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, DateTime, String, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Flight(Base):
    __tablename__ = "flights"
    __table_args__ = (
        CheckConstraint(
            "operational_status IN ('UNKNOWN', 'SCHEDULED', 'DELAYED', 'BOARDING', "
            "'DEPARTED', 'ARRIVED', 'CANCELLED')",
            name="ck_flights_operational_status",
        ),
        CheckConstraint(
            "estimated_arrival_time > estimated_departure_time",
            name="ck_flights_estimated_times",
        ),
        CheckConstraint(
            "actual_arrival_time > actual_departure_time",
            name="ck_flights_actual_times",
        ),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    flight_number: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    origin: Mapped[str] = mapped_column(String(3), nullable=False, index=True)
    destination: Mapped[str] = mapped_column(String(3), nullable=False, index=True)
    departure_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    arrival_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    operational_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="UNKNOWN", server_default="UNKNOWN"
    )
    estimated_departure_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    estimated_arrival_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    actual_departure_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    actual_arrival_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status_reported_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    terminal: Mapped[str | None] = mapped_column(String(10), nullable=True)
    gate: Mapped[str | None] = mapped_column(String(10), nullable=True)
    aircraft: Mapped[str | None] = mapped_column(String(30), nullable=True)
    is_connecting: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    connecting_carrier: Mapped[str | None] = mapped_column(String(50), nullable=True)
    cabins: Mapped[dict[str, dict[str, Any]]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
