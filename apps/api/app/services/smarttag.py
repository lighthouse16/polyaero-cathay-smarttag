"""SmartTag payload builders.

The NDEF record stays free of names and PNR because any NFC phone can read it.
The richer display payload is what the E-ink bridge renders.
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


def build_barcode(tag_id: UUID) -> str:
    digest = hashlib.sha256(str(tag_id).encode()).hexdigest()
    return f"016{int(digest[:8], 16) % 10**7:07d}"


def build_ndef_record(tag: Tag, flight: Flight, barcode: str) -> str:
    record = {
        "v": 1,
        "tag": str(tag.id),
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
    tag: Tag, booking: Booking, flight: Flight, user: User, barcode: str
) -> dict[str, Any]:
    passenger = (
        f"{(user.family_name or '').upper()}/{(user.given_names or ' ')[:1].upper()}"
    )
    return {
        "tag": str(tag.id),
        "flight": flight.flight_number,
        "route": f"{flight.origin}->{flight.destination}",
        "destination": flight.destination,
        "departure": flight.departure_time.isoformat(),
        "terminal": flight.terminal,
        "gate": flight.gate,
        "passenger": passenger,
        "pnr": booking.pnr,
        "barcode": barcode,
        "bags": f"{booking.selected_bags}/{booking.allowed_bags}",
        "status": "SYNCHRONIZED",
        "updated_at": datetime.now(UTC).isoformat(),
    }
