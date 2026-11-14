from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class SmartTagPrepare(BaseModel):
    booking_id: UUID
    pnr: str
    demo_checkin_completed: bool
    allowed_bags: int
    selected_bags: int
    smarttag_available: bool
    tag_id: UUID | None
    sync_state: str | None
    ready: bool


class SyncPayloadRequest(BaseModel):
    booking_id: UUID
    hardware_nfc_id: str | None = Field(None, max_length=100)


class SyncPayloadResponse(BaseModel):
    tag_id: UUID
    booking_id: UUID
    sync_state: str
    is_simulated: bool
    ndef_record: str
    nfc_payload_hash: str
    bar_code_payload: str
    display_payload: dict[str, Any]
    mqtt_published: bool
