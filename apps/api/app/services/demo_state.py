import copy
from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, Field


class RiskPredictionRequest(BaseModel):
    flight_number: str = "CX888"
    origin: str = "HKG"
    destination: str = "YVR"
    transfer_minutes: int = Field(default=55, ge=0)
    weather_severity: int = Field(default=2, ge=1, le=5)
    load_factor_pct: float = Field(default=88.0, ge=0, le=100)
    airport_congestion: int = Field(default=3, ge=1, le=5)


class RiskPredictionResponse(BaseModel):
    risk_score: int
    risk_level: str
    priority_sequence: int
    recommended_action: str
    passenger_alert: str | None
    factors: list[str]


def compute_mishandling_risk(req: RiskPredictionRequest) -> RiskPredictionResponse:
    score = 10
    factors: list[str] = []

    if req.transfer_minutes < 45:
        score += 38
        factors.append(f"Tight connection window ({req.transfer_minutes}m < 45m MCT)")
    elif req.transfer_minutes < 75:
        score += 18
        factors.append(f"Moderate transfer buffer ({req.transfer_minutes}m)")

    if req.weather_severity >= 4:
        score += 28
        factors.append(f"Severe weather disruption advisory (Level {req.weather_severity}/5)")
    elif req.weather_severity == 3:
        score += 14
        factors.append("Moderate weather delay risk")

    if req.load_factor_pct >= 90:
        score += 15
        factors.append(f"High flight load factor ({req.load_factor_pct:.0f}%)")

    if req.airport_congestion >= 4:
        score += 15
        factors.append(f"Peak hub bank density (Level {req.airport_congestion}/5)")

    score = min(score, 99)

    if score >= 65:
        return RiskPredictionResponse(
            risk_score=score,
            risk_level="HIGH_PRIORITY",
            priority_sequence=1,
            recommended_action="APPROVE RAMP INTERCEPT & OFFER PASSENGER RECOVERY OPTIONS",
            passenger_alert=f"Tight connection detected on {req.flight_number} ({req.origin}->{req.destination}). Choose your recovery preference.",
            factors=factors or ["Elevated composite itinerary risk"],
        )
    if score >= 35:
        return RiskPredictionResponse(
            risk_score=score,
            risk_level="MEDIUM",
            priority_sequence=2,
            recommended_action="PROACTIVE GATE TRANSFER MONITORING",
            passenger_alert=None,
            factors=factors or ["Standard transfer monitoring"],
        )
    return RiskPredictionResponse(
        risk_score=score,
        risk_level="LOW",
        priority_sequence=3,
        recommended_action="STANDARD DIGITAL ITINERARY FLOW",
        passenger_alert=None,
        factors=factors or ["Optimal schedule & connection window"],
    )


def _initial_bags() -> dict[str, dict[str, Any]]:
    now = datetime.now(UTC).isoformat()
    return {
        "0160892012": {
            "id": "bag_01",
            "tag_number": "0160892012",
            "tag_code": "04:A2:3B:4C:5D:6E:70",
            "tag_interface": "SMARTTAG_EINK_EXCLUSIVE",
            "booking_reference": "CX7K9M",
            "passenger_name": "CHAN/TIMOTHY",
            "tier_status": "DIAMOND",
            "cabin_class": "PRIORITY J",
            "flight_number": "CX888",
            "departure_airport": "HKG",
            "arrival_airport": "YVR",
            "departure_time": "2026-11-14T16:30:00Z",
            "seat_number": "12A",
            "weight_kg": 22.4,
            "connection_minutes": 95,
            "status": "LOADED",
            "last_known_location": "HKG-T1-GATE-36-ULD-AK7291",
            "carousel_assigned": "Carousel 7",
            "is_rush_bag": False,
            "risk_score": 24,
            "risk_level": "LOW",
            "recommended_action": "STANDARD DIGITAL ITINERARY FLOW",
            "copilot_approval_status": "AUTO_CLEARED",
            "passenger_recovery_choice": None,
            "eink_banner": "ON TRACK",
            "updated_at": now,
            "events": [
                {
                    "id": "evt_01",
                    "event_type": "TAGGED",
                    "timestamp": "2026-11-14T11:00:00Z",
                    "location_code": "HKG-APP",
                    "station_name": "Cathay Mobile Check-In & Risk Scan",
                    "scanner_type": "NFC_TAP",
                    "notes": "Check-in risk evaluated (Score 24/100 LOW); Diamond SmartTag synced",
                },
                {
                    "id": "evt_02",
                    "event_type": "CHECKED_IN",
                    "timestamp": "2026-11-14T14:15:00Z",
                    "location_code": "HKG-T1-DROP-04",
                    "station_name": "Self Bag Drop Counter 4",
                    "scanner_type": "OPTICAL_BARCODE",
                    "notes": "Biometric face match + scale weight 22.4 kg verified",
                },
                {
                    "id": "evt_03",
                    "event_type": "LOADED",
                    "timestamp": "2026-11-14T15:45:00Z",
                    "location_code": "HKG-GATE-36-RAMP",
                    "station_name": "Baggage Makeup Ramp Gate 36",
                    "scanner_type": "NFC_TAP",
                    "notes": "Loaded into Container AK7291 for CX888",
                },
            ],
        },
        "0160892014": {
            "id": "bag_03",
            "tag_number": "0160892014",
            "tag_code": "04:B3:7C:1D:9E:2F:81",
            "tag_interface": "DIGITAL_APP_TAG",
            "booking_reference": "CX4M1P",
            "passenger_name": "WONG/VICTOR",
            "tier_status": "GOLD",
            "cabin_class": "BUSINESS",
            "flight_number": "CX255",
            "departure_airport": "HKG",
            "arrival_airport": "NRT",
            "departure_time": "2026-11-14T08:15:00Z",
            "seat_number": "14K",
            "weight_kg": 28.5,
            "connection_minutes": 35,
            "status": "MISROUTED",
            "last_known_location": "HKG-TRANSFER-STAGING-AREA",
            "carousel_assigned": "Carousel 2",
            "is_rush_bag": True,
            "risk_score": 82,
            "risk_level": "HIGH_PRIORITY",
            "recommended_action": "APPROVE RAMP INTERCEPT & OFFER PASSENGER RECOVERY OPTIONS",
            "copilot_approval_status": "PENDING_STAFF_APPROVAL",
            "passenger_recovery_choice": None,
            "eink_banner": "PRIORITY TRANSFER",
            "updated_at": now,
            "events": [
                {
                    "id": "evt_10",
                    "event_type": "MISROUTED",
                    "timestamp": "2026-11-14T07:30:00Z",
                    "location_code": "HKG-TRANSFER-STAGING-AREA",
                    "station_name": "HKIA Transfer Bay 2",
                    "scanner_type": "RFID_GATE",
                    "notes": "Copilot flagged 35m connection risk (Score 82) — awaiting Ground Staff approval",
                }
            ],
        },
    }


LIVE_BAGS: dict[str, dict[str, Any]] = _initial_bags()


def reset_demo_bags() -> list[dict[str, Any]]:
    LIVE_BAGS.clear()
    LIVE_BAGS.update(copy.deepcopy(_initial_bags()))
    return list(LIVE_BAGS.values())
