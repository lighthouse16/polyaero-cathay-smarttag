from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.demo_state import (
    LIVE_BAGS,
    RiskPredictionRequest,
    RiskPredictionResponse,
    compute_mishandling_risk,
    reset_demo_bags,
)

router = APIRouter()


class SyncTagRequest(BaseModel):
    tag_number: str = "0160892012"
    tag_code: str = "04:A2:3B:4C:5D:6E:70"
    passenger_name: str = "CHAN/TIMOTHY"
    flight_number: str = "CX888"
    departure_airport: str = "HKG"
    arrival_airport: str = "YVR"
    cabin_class: str = "PRIORITY J"
    weight_kg: float = 22.4


class ScanEventRequest(BaseModel):
    event_type: str
    location_code: str = "HKG-T1-RAMP-04"
    station_name: str = "HKIA Terminal 1 Ramp Checkpoint"
    scanner_type: str = "NFC_TAP"
    staff_id: str | None = None
    notes: str | None = None


class IrropsRerouteRequest(BaseModel):
    new_flight_number: str = "CX890"
    reason: str = "Tight transfer connection — auto-rebooked & express routed"


@router.get("")
async def list_baggage() -> list[dict[str, Any]]:
    return list(LIVE_BAGS.values())


@router.post("/reset")
async def reset_demo_state() -> list[dict[str, Any]]:
    return reset_demo_bags()


@router.get("/{tag_number}")
async def get_baggage_by_tag(tag_number: str) -> dict[str, Any]:
    bag = LIVE_BAGS.get(tag_number)
    if not bag:
        raise HTTPException(status_code=404, detail=f"Baggage tag {tag_number} not found")
    return bag


@router.post("/sync")
async def sync_smarttag_from_mobile(payload: SyncTagRequest) -> dict[str, Any]:
    now = datetime.now(UTC).isoformat()
    existing = LIVE_BAGS.get(payload.tag_number)
    events = existing["events"] if existing else []
    events.append(
        {
            "id": f"evt_{uuid4().hex[:6]}",
            "event_type": "TAGGED",
            "timestamp": now,
            "location_code": "MOBILE-NFC-WRITE",
            "station_name": "Passenger Mobile App NFC Sync",
            "scanner_type": "NFC_TAP",
            "notes": f"E-Ink updated to {payload.flight_number} ({payload.departure_airport}->{payload.arrival_airport})",
        }
    )

    bag_record: dict[str, Any] = {
        "id": existing["id"] if existing else f"bag_{uuid4().hex[:6]}",
        "tag_number": payload.tag_number,
        "tag_code": payload.tag_code,
        "booking_reference": existing["booking_reference"] if existing else "CX7K9M",
        "passenger_name": payload.passenger_name,
        "tier_status": existing["tier_status"] if existing else "DIAMOND",
        "cabin_class": payload.cabin_class,
        "flight_number": payload.flight_number,
        "departure_airport": payload.departure_airport,
        "arrival_airport": payload.arrival_airport,
        "departure_time": "2026-11-14T16:30:00Z",
        "seat_number": existing["seat_number"] if existing else "12A",
        "weight_kg": payload.weight_kg,
        "status": "TAGGED",
        "last_known_location": "MOBILE-NFC-SYNCED",
        "carousel_assigned": existing["carousel_assigned"] if existing else "Carousel 7",
        "is_rush_bag": False,
        "risk_score": 18,
        "risk_level": "LOW",
        "conveyor_action": "AUTOMATED_MAINLINE_BELT",
        "eink_banner": "SYNCHRONIZED",
        "updated_at": now,
        "events": events,
    }
    LIVE_BAGS[payload.tag_number] = bag_record
    return bag_record


@router.post("/{tag_number}/scan")
async def record_baggage_scan(tag_number: str, payload: ScanEventRequest) -> dict[str, Any]:
    bag = LIVE_BAGS.get(tag_number)
    if not bag:
        raise HTTPException(status_code=404, detail=f"Baggage tag {tag_number} not found")

    now = datetime.now(UTC).isoformat()
    status_upper = payload.event_type.upper()
    bag["status"] = status_upper
    bag["last_known_location"] = payload.location_code
    bag["updated_at"] = now

    if status_upper in {"MISROUTED", "MISSING"}:
        bag["is_rush_bag"] = True
        bag["risk_score"] = 88
        bag["risk_level"] = "HIGH_PRIORITY"
        bag["conveyor_action"] = "DIVERT_TO_EXPRESS_TRANSFER_CHUTE"
        bag["eink_banner"] = "ATTENTION / REROUTE"
    elif status_upper in {"LOADED", "ON_CAROUSEL", "CLAIMED"}:
        bag["is_rush_bag"] = False
        bag["eink_banner"] = "ON TRACK"
    else:
        bag["eink_banner"] = status_upper.replace("_", " ")

    bag["events"].append(
        {
            "id": f"evt_{uuid4().hex[:6]}",
            "event_type": status_upper,
            "timestamp": now,
            "location_code": payload.location_code,
            "station_name": payload.station_name,
            "handled_by_staff_id": payload.staff_id,
            "scanner_type": payload.scanner_type,
            "notes": payload.notes or f"Updated to {status_upper} at {payload.station_name}",
        }
    )
    return bag


@router.post("/{tag_number}/recover")
async def staff_handheld_nfc_recover(tag_number: str) -> dict[str, Any]:
    bag = LIVE_BAGS.get(tag_number)
    if not bag:
        raise HTTPException(status_code=404, detail=f"Baggage tag {tag_number} not found")

    now = datetime.now(UTC).isoformat()
    bag["status"] = "LOADED"
    bag["is_rush_bag"] = False
    bag["risk_score"] = 15
    bag["risk_level"] = "LOW"
    bag["conveyor_action"] = "AUTOMATED_MAINLINE_BELT"
    bag["last_known_location"] = f"HKG-GATE-EXPRESS-ULD-{bag['flight_number']}"
    bag["eink_banner"] = "VERIFIED • LOADED"
    bag["updated_at"] = now
    bag["events"].append(
        {
            "id": f"evt_{uuid4().hex[:6]}",
            "event_type": "LOADED",
            "timestamp": now,
            "location_code": "HKG-HANDHELD-NFC",
            "station_name": "Ramp Handheld NFC Verification",
            "handled_by_staff_id": "STF-8821",
            "scanner_type": "NFC_TAP",
            "notes": f"Ownership verified ({bag['passenger_name']}); bag recovered & loaded onto {bag['flight_number']}",
        }
    )
    return bag


@router.post("/{tag_number}/irrops")
async def trigger_irrops_reroute(tag_number: str, payload: IrropsRerouteRequest) -> dict[str, Any]:
    bag = LIVE_BAGS.get(tag_number)
    if not bag:
        raise HTTPException(status_code=404, detail=f"Baggage tag {tag_number} not found")

    now = datetime.now(UTC).isoformat()
    old_flight = bag["flight_number"]
    bag["flight_number"] = payload.new_flight_number
    bag["status"] = "MISROUTED"
    bag["is_rush_bag"] = True
    bag["risk_score"] = 91
    bag["risk_level"] = "HIGH_PRIORITY"
    bag["conveyor_action"] = "DIVERT_TO_EXPRESS_TRANSFER_CHUTE"
    bag["eink_banner"] = f"UPDATED ROUTE | {payload.new_flight_number}"
    bag["updated_at"] = now
    bag["events"].append(
        {
            "id": f"evt_{uuid4().hex[:6]}",
            "event_type": "MISROUTED",
            "timestamp": now,
            "location_code": "HKG-BHS-EXPRESS-CHUTE-1",
            "station_name": "Automated BHS Express Diversion",
            "scanner_type": "RFID_GATE",
            "notes": f"IRROPS rerouted {old_flight} -> {payload.new_flight_number}: {payload.reason}",
        }
    )
    return bag


@router.post("/risk/predict", response_model=RiskPredictionResponse)
async def predict_mishandling_risk(payload: RiskPredictionRequest) -> RiskPredictionResponse:
    return compute_mishandling_risk(payload)


@router.post("/{tag_number}/risk/apply", response_model=RiskPredictionResponse)
async def apply_mishandling_risk_to_bag(
    tag_number: str, payload: RiskPredictionRequest
) -> RiskPredictionResponse:
    bag = LIVE_BAGS.get(tag_number)
    if not bag:
        raise HTTPException(status_code=404, detail=f"Baggage tag {tag_number} not found")

    result = compute_mishandling_risk(payload)
    now = datetime.now(UTC).isoformat()
    bag["risk_score"] = result.risk_score
    bag["risk_level"] = result.risk_level
    bag["conveyor_action"] = result.conveyor_action
    bag["updated_at"] = now

    if result.risk_level == "HIGH_PRIORITY":
        bag["is_rush_bag"] = True
        bag["eink_banner"] = "PRIORITY TRANSFER"
        bag["events"].append(
            {
                "id": f"evt_{uuid4().hex[:6]}",
                "event_type": "MISROUTED",
                "timestamp": now,
                "location_code": "HKG-AI-CONVEYOR-GATE",
                "station_name": "AI Conveyor Diversion Gate",
                "scanner_type": "RFID_GATE",
                "notes": f"AI Risk Score {result.risk_score}/100 -> {result.conveyor_action}",
            }
        )
    else:
        bag["is_rush_bag"] = False
        bag["eink_banner"] = "ON TRACK"

    return result
