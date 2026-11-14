from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    flight_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("flights.id"), nullable=False, index=True
    )
    pnr: Mapped[str] = mapped_column(String(10), unique=True, nullable=False, index=True)
    booking_status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="UPCOMING", server_default="UPCOMING"
    )
    checkin_status: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    allowed_bags: Mapped[int] = mapped_column(
        Integer, nullable=False, default=2, server_default="2"
    )
    selected_bags: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default="1"
    )
    cabin_class: Mapped[str] = mapped_column(
        String(20), nullable=False, default="ECONOMY", server_default="ECONOMY"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
