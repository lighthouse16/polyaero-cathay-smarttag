from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.services.demo_state import LIVE_BAGS

router = APIRouter()


class HardwareTapRequest(BaseModel):
    reader_id: str = "ESP32-PN532-01"
    station_name: str = "HKIA Self Bag Drop / Ramp Reader"
    next_status: str | None = None


def _find_bag_by_tag_code(tag_code: str) -> dict[str, Any] | None:
    normalized = tag_code.strip().upper()
    for bag in LIVE_BAGS.values():
        if bag["tag_code"].upper() == normalized or bag["tag_number"] == normalized:
            return bag
    return None


@router.get("/{tag_code}/display")
async def get_eink_display_payload(tag_code: str) -> dict[str, Any]:
    """Compact payload polled by the ESP32-S3 to render the 4.2-inch E-Paper screen."""
    bag = _find_bag_by_tag_code(tag_code)
    if not bag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Tag not registered")

    return {
        "tag_code": bag["tag_code"],
        "bag_number": bag["tag_number"],
        "flight": bag["flight_number"],
        "origin": bag["departure_airport"],
        "destination": bag["arrival_airport"],
        "passenger": bag["passenger_name"],
        "cabin": bag["cabin_class"],
        "weight_kg": bag["weight_kg"],
        "status": bag["status"],
        "banner": bag["eink_banner"],
        "is_rush": bag["is_rush_bag"],
        "updated_at": bag["updated_at"],
    }


@router.post("/{tag_code}/tap")
async def hardware_nfc_tap(tag_code: str, tap: HardwareTapRequest) -> dict[str, Any]:
    """Triggered when PN532 NFC module detects a phone or staff handheld tap."""
    bag = _find_bag_by_tag_code(tag_code)
    if not bag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Tag not registered")

    now = datetime.now(UTC).isoformat()
    if tap.next_status:
        bag["status"] = tap.next_status
    bag["updated_at"] = now
    bag["events"].insert(
        0,
        {
            "id": f"evt_hw_{int(datetime.now(UTC).timestamp())}",
            "event_type": bag["status"],
            "timestamp": now,
            "location_code": tap.reader_id,
            "station_name": tap.station_name,
            "scanner_type": "NFC_TAP",
            "notes": f"Physical PN532 NFC tap verified by {tap.reader_id}",
        },
    )
    return {"acknowledged": True, "bag": bag}
