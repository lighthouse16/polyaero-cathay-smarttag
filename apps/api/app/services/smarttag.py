"""SmartTag payload builders.

The NDEF record stays free of names and PNR because any NFC phone can read it.
The display payload is what the E-ink bridge renders.
"""

import hashlib
import json
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from app.models.auth import User
from app.models.baggage import Tag
from app.models.booking import Booking
from app.models.flight import Flight
from app.services.baggage import banner_for, is_rush


def build_barcode(tag_id: UUID) -> str:
    digest = hashlib.sha256(str(tag_id).encode()).hexdigest()
    return f"016{int(digest[:8], 16) % 10**7:07d}"


def build_ndef_record(
    tag: Tag, booking: Booking, flight: Flight, barcode: str
) -> str:
    record = {
        "v": 1,
        "tag": str(tag.id),
        "tag_code": tag.tag_code,
        "booking": str(booking.id),
        "flight": flight.flight_number,
        "route": f"{flight.origin}-{flight.destination}",
        "barcode": barcode,
        "status": "SYNCHRONIZED",
        "at": datetime.now(UTC).isoformat(),
    }
    return json.dumps(record, separators=(",", ":"), sort_keys=True)


def hash_payload(record: str) -> str:
    return hashlib.sha256(record.encode()).hexdigest()


def build_display_payload(
    tag: Tag,
    booking: Booking,
    flight: Flight,
    user: User | None,
    barcode: str | None = None,
) -> dict[str, Any]:
    barcode = barcode or tag.bar_code_payload or tag.baggage_barcode
    passenger = ""
    if user is not None:
        passenger = (
            f"{(user.family_name or '').upper()}/{(user.given_names or ' ')[:1].upper()}"
        )
    status = tag.tag_status
    return {
        "tag": str(tag.id),
        "tag_code": tag.tag_code,
        "bag_number": barcode,
        "booking_id": str(booking.id),
        "pnr": booking.pnr,
        "flight": flight.flight_number,
        "origin": flight.origin,
        "destination": flight.destination,
        "route": f"{flight.origin}->{flight.destination}",
        "departure": flight.departure_time.isoformat(),
        "terminal": flight.terminal,
        "gate": flight.gate,
        "passenger": passenger,
        "cabin": booking.cabin_class,
        "weight_kg": tag.weight_kg,
        "barcode": barcode,
        "bags": f"{booking.selected_bags}/{booking.allowed_bags}",
        "status": status,
        "banner": banner_for(status),
        "is_rush": is_rush(status),
        "sync_state": tag.sync_state,
        "updated_at": datetime.now(UTC).isoformat(),
    }
