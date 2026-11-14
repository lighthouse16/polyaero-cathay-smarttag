from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TagBase(BaseModel):
    tag_code: str = Field(..., min_length=1, max_length=50, description="Unique NFC tag identifier")
    is_active: bool = True
    firmware_version: str | None = Field(None, max_length=20)
    hardware_revision: str | None = Field(None, max_length=20)


class TagCreate(TagBase):
    pass


class TagUpdate(BaseModel):
    tag_code: str | None = Field(None, min_length=1, max_length=50)
    is_active: bool | None = None
    firmware_version: str | None = Field(None, max_length=20)
    hardware_revision: str | None = Field(None, max_length=20)
    last_seen_at: datetime | None = None


class TagRead(TagBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID | None
    pnr: str | None
    baggage_barcode: str | None
    tag_status: str
    last_synced_at: datetime | None
    booking_id: UUID | None
    sync_state: str
    nfc_payload_hash: str | None
    bar_code_payload: str | None
    is_simulated: bool
    weight_kg: float | None
    created_at: datetime
    updated_at: datetime


class HardwareTapRequest(BaseModel):
    reader_id: str = Field("ESP32-PN532-01", max_length=50)
    station_name: str = Field("HKIA Self Bag Drop / Ramp Reader", max_length=100)
    location_code: str | None = Field(None, max_length=50)
    next_status: str | None = Field(None, max_length=30)
    ndef_payload: str | None = Field(None, max_length=1024)
