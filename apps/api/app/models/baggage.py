from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.flight import Flight


class Baggage(Base):
    __tablename__ = "baggage"
    __table_args__ = (
        CheckConstraint("connection_minutes >= 0", name="ck_baggage_connection_minutes"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    passenger_name: Mapped[str] = mapped_column(String(255), nullable=False)
    flight_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("flights.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    seat_number: Mapped[str | None] = mapped_column(String(10), nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    connection_minutes: Mapped[int] = mapped_column(Integer, default=85, server_default="85")
    tag_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tags.id"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    tag: Mapped["Tag"] = relationship("Tag", back_populates="baggage")
    flight: Mapped[Flight] = relationship()


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    tag_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    firmware_version: Mapped[str | None] = mapped_column(String(20), nullable=True)
    hardware_revision: Mapped[str | None] = mapped_column(String(20), nullable=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    pnr: Mapped[str | None] = mapped_column(
        String(10), ForeignKey("bookings.pnr"), nullable=True, index=True
    )
    baggage_barcode: Mapped[str | None] = mapped_column(String(50), nullable=True)
    tag_status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="UNLINKED", server_default="UNLINKED"
    )
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    booking_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("bookings.id"), nullable=True, index=True
    )
    sync_state: Mapped[str] = mapped_column(
        String(20), nullable=False, default="PREPARE", server_default="PREPARE"
    )
    nfc_payload_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    bar_code_payload: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_simulated: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    baggage: Mapped["Baggage"] = relationship("Baggage", back_populates="tag", uselist=False)
    events: Mapped[list["BaggageEvent"]] = relationship(
        "BaggageEvent", back_populates="tag", cascade="all, delete-orphan"
    )


class BaggageEvent(Base):
    """Append-only baggage milestone log written by taps, app sync, and staff scans."""

    __tablename__ = "baggage_events"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    tag_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tags.id", ondelete="CASCADE"), nullable=False, index=True
    )
    booking_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("bookings.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    event_type: Mapped[str] = mapped_column(String(30), nullable=False)
    location_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    station_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    reader_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    scanner_type: Mapped[str] = mapped_column(
        String(30), nullable=False, default="NFC_TAP", server_default="NFC_TAP"
    )
    notes: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    tag: Mapped["Tag"] = relationship("Tag", back_populates="events")
