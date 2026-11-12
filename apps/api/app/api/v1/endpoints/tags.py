import json
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.models.auth import User
from app.models.baggage import Tag
from app.models.booking import Booking
from app.models.flight import Flight
from app.schemas.tag import HardwareTapRequest
from app.services.baggage import (
    banner_for,
    find_tag,
    is_rush,
    normalize_status,
    record_event,
)
from app.services.demo_state import LIVE_BAGS
from app.services.smarttag import build_display_payload

router = APIRouter()


async def require_device_key(x_device_key: str | None = Header(None)) -> None:
    """Keep the write path closed once a deployment sets IOT_DEVICE_KEY."""
    expected = get_settings().iot_device_key
    if expected and x_device_key != expected:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid device key")


def _find_demo_bag(identifier: str) -> dict[str, Any] | None:
    normalized = identifier.strip().upper()
    for bag in LIVE_BAGS.values():
        if bag["tag_code"].upper() == normalized or bag["tag_number"] == normalized:
            return bag
    return None


def _demo_display(bag: dict[str, Any]) -> dict[str, Any]:
    return {
        "tag": bag["tag_code"],
        "tag_code": bag["tag_code"],
        "bag_number": bag["tag_number"],
        "pnr": bag["booking_reference"],
        "flight": bag["flight_number"],
        "origin": bag["departure_airport"],
        "destination": bag["arrival_airport"],
        "route": f"{bag['departure_airport']}->{bag['arrival_airport']}",
        "passenger": bag["passenger_name"],
        "cabin": bag["cabin_class"],
        "weight_kg": bag["weight_kg"],
        "barcode": bag["tag_number"],
        "status": bag["status"],
        "banner": bag["eink_banner"],
        "is_rush": bag["is_rush_bag"],
        "sync_state": "READY",
        "updated_at": bag["updated_at"],
    }


def _tag_only_display(tag: Tag) -> dict[str, Any]:
    barcode = tag.bar_code_payload or tag.baggage_barcode
    return {
        "tag": str(tag.id),
        "tag_code": tag.tag_code,
        "bag_number": barcode,
        "pnr": tag.pnr,
        "flight": None,
        "origin": None,
        "destination": None,
        "route": None,
        "passenger": None,
        "cabin": None,
        "weight_kg": tag.weight_kg,
        "barcode": barcode,
        "status": tag.tag_status,
        "banner": banner_for(tag.tag_status),
        "is_rush": is_rush(tag.tag_status),
        "sync_state": tag.sync_state,
        "updated_at": datetime.now(UTC).isoformat(),
    }


async def _db_display(db: AsyncSession, tag: Tag) -> dict[str, Any]:
    booking = await db.get(Booking, tag.booking_id) if tag.booking_id else None
    if booking is None:
        return _tag_only_display(tag)
    flight = await db.get(Flight, booking.flight_id)
    if flight is None:
        return _tag_only_display(tag)
    user = await db.get(User, booking.user_id) if booking.user_id else None
    return build_display_payload(tag, booking, flight, user)


@router.get("/{identifier}/display")
async def get_eink_display_payload(
    identifier: str, db: AsyncSession = Depends(get_db)
) -> dict[str, Any]:
    """Payload polled by the ESP32-S3 to render the E-Paper screen."""
    tag = await find_tag(db, identifier)
    if tag is not None:
        return await _db_display(db, tag)

    bag = _find_demo_bag(identifier)
    if bag is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not registered")
    return _demo_display(bag)


@router.post("/{identifier}/tap", dependencies=[Depends(require_device_key)])
async def hardware_nfc_tap(
    identifier: str,
    tap: HardwareTapRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Receive the NDEF payload the phone wrote and advance baggage progress."""
    tag = await find_tag(db, identifier)

    if tag is None:
        bag = _find_demo_bag(identifier)
        if bag is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Tag not registered"
            )
        now = datetime.now(UTC).isoformat()
        if tap.next_status:
            bag["status"] = tap.next_status.upper()
        bag["updated_at"] = now
        bag["events"].insert(
            0,
            {
                "id": f"evt_hw_{int(datetime.now(UTC).timestamp())}",
                "event_type": bag["status"],
                "timestamp": now,
                "location_code": tap.location_code or tap.reader_id,
                "station_name": tap.station_name,
                "scanner_type": "NFC_TAP",
                "notes": f"Physical PN532 NFC tap verified by {tap.reader_id}",
            },
        )
        return {"acknowledged": True, "display": _demo_display(bag)}

    event_type = "TAG_TAPPED"
    notes: str | None = None

    if tap.ndef_payload:
        try:
            ndef = json.loads(tap.ndef_payload)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="ndef_payload must be JSON",
            ) from exc
        if not isinstance(ndef, dict):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="ndef_payload must be a JSON object",
            )
        if ndef.get("tag") and str(ndef["tag"]) != str(tag.id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="NDEF tag does not match this SmartTag",
            )
        if (
            ndef.get("barcode")
            and tag.bar_code_payload
            and str(ndef["barcode"]) != tag.bar_code_payload
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="NDEF barcode does not match this SmartTag",
            )
        if ndef.get("status"):
            try:
                event_type = normalize_status(str(ndef["status"]))
            except ValueError as exc:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)
                ) from exc
        notes = ndef.get("flight")
        notes = str(notes)[:255] if notes else None
    elif tap.next_status:
        try:
            event_type = normalize_status(tap.next_status)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)
            ) from exc

    await record_event(
        db,
        tag,
        event_type,
        location_code=tap.location_code or tap.reader_id,
        station_name=tap.station_name,
        reader_id=tap.reader_id,
        notes=notes,
    )
    await db.commit()
    await db.refresh(tag)

    return {"acknowledged": True, "display": await _db_display(db, tag)}
