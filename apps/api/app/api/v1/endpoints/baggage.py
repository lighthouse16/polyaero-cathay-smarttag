from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.demo_state import (
    LIVE_BAGS,
    RiskPredictionRequest,
    RiskPredictionResponse,
    reset_demo_bags,
)
from app.services.risk_engine import (
    ACTIVE_RISK_MODEL,
    FlightRiskAssessment,
    FlightRiskFeatures,
)

router = APIRouter()


class SyncTagRequest(BaseModel):
    tag_number: str = "0160892012"
    tag_code: str = "04:A2:3B:4C:5D:6E:70"
    passenger_name: str = "TRINH/HAI DANG"
    flight_number: str = "CX548"
    departure_airport: str = "HKG"
    arrival_airport: str = "HND"
    cabin_class: str = "BUSINESS"
    weight_kg: float = 22.4
    connection_minutes: int = 85
    weather_severity: int = 2
    load_factor_pct: float = 86.0
    airport_congestion: int = 2
    initial_status: str = "AWAITING_SYNC"


class ScanEventRequest(BaseModel):
    event_type: str
    location_code: str = "HKG-T1-RAMP-04"
    station_name: str = "HKIA Terminal 1 Operations"
    scanner_type: str = "NFC_TAP"
    staff_id: str | None = None
    notes: str | None = None


class PassengerChoiceRequest(BaseModel):
    choice: str
    hotel_address: str | None = None


def _compute_recovery_details(bag: dict[str, Any], choice: str, hotel_address: str | None) -> dict[str, Any]:
    now = datetime.now(UTC)
    orig_flight = bag.get("flight_number", "CX548")
    dest = bag.get("arrival_airport", "HND")

    if choice == "EXPRESS_NEXT_FLIGHT":
        next_flight = "CX524" if orig_flight == "CX548" else ("CX890" if orig_flight == "CX888" else "CX257")
        eta_dt = now + timedelta(hours=4, minutes=35)
        eta_str = eta_dt.strftime("%d %b, %H:%M Local")
        return {
            "recovery_flight_number": next_flight,
            "recovery_eta": f"{eta_str} ({dest} Belt 4)",
            "delivery_address": None,
            "eink_banner": f"EXPRESS {next_flight} • {dest}",
            "summary": f"Rebooked onto {next_flight} · Estimated arrival: {eta_str}",
        }
    else:
        clean_addr = (hotel_address or "").strip() or "Mandarin Oriental, Tokyo (Concierge Desk)"
        eta_dt = now + timedelta(hours=6, minutes=15)
        eta_str = eta_dt.strftime("%d %b, %H:%M Local")
        return {
            "recovery_flight_number": orig_flight,
            "recovery_eta": f"Courier delivery by {eta_str}",
            "delivery_address": clean_addr,
            "eink_banner": "COURIER • HOTEL DELIVERY",
            "summary": f"Courier dispatched to {clean_addr} · ETA: {eta_str}",
        }


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
    events = list(existing["events"]) if existing else []

    assessment = ACTIVE_RISK_MODEL.predict(
        FlightRiskFeatures(
            flight_number=payload.flight_number,
            origin=payload.departure_airport,
            destination=payload.arrival_airport,
            transfer_minutes=payload.connection_minutes,
            weather_severity=payload.weather_severity,
            load_factor_pct=payload.load_factor_pct,
            airport_congestion=payload.airport_congestion,
        )
    )

    status_code = payload.initial_status.upper()
    is_synced = status_code != "AWAITING_SYNC"
    is_high_risk = assessment.risk_level == "HIGH_PRIORITY"

    if is_synced:
        events.append(
            {
                "id": f"evt_{uuid4().hex[:6]}",
                "event_type": "TAGGED",
                "timestamp": now,
                "location_code": "MOBILE-SMARTTAG-SYNC",
                "station_name": "Cathay App SmartTag™ Sync",
                "scanner_type": "NFC_TAP",
                "notes": f"Tag synced · AI Risk Score {assessment.risk_score}/100 ({assessment.risk_level})",
            }
        )
    elif not events:
        events.append(
            {
                "id": f"evt_{uuid4().hex[:6]}",
                "event_type": "AWAITING_SYNC",
                "timestamp": now,
                "location_code": "BOOKING-CREATED",
                "station_name": "Flight Booked · AI Risk Evaluated",
                "scanner_type": "APP",
                "notes": f"AI Risk Score {assessment.risk_score}/100 · Expected arrival {assessment.predicted_arrival_time}",
            }
        )

    bag_record: dict[str, Any] = {
        "id": existing["id"] if existing else f"bag_{uuid4().hex[:6]}",
        "tag_number": payload.tag_number,
        "tag_code": payload.tag_code,
        "tag_interface": existing.get("tag_interface", "E-Ink SmartTag™") if existing else "E-Ink SmartTag™",
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
        "connection_minutes": payload.connection_minutes,
        "status": status_code,
        "is_tag_synced": is_synced,
        "last_known_location": "SMARTTAG-SYNCED" if is_synced else "AWAITING-TAG-SYNC",
        "carousel_assigned": assessment.carousel_estimate,
        "is_rush_bag": is_high_risk,
        "risk_score": assessment.risk_score,
        "risk_level": assessment.risk_level,
        "risk_factors": assessment.factors,
        "passenger_risk_summary": assessment.passenger_summary,
        "predicted_arrival_time": assessment.predicted_arrival_time,
        "model_version": assessment.model_version,
        "recommended_action": assessment.recommended_action,
        "passenger_recovery_choice": existing.get("passenger_recovery_choice") if existing else None,
        "recovery_flight_number": existing.get("recovery_flight_number") if existing else None,
        "recovery_eta": existing.get("recovery_eta") if existing else None,
        "delivery_address": existing.get("delivery_address") if existing else None,
        "eink_banner": ("TAG SYNCED • " + payload.flight_number) if is_synced else "AWAITING TAG SYNC",
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
    bag["is_tag_synced"] = status_upper != "AWAITING_SYNC"
    bag["last_known_location"] = payload.location_code
    bag["updated_at"] = now

    if status_upper == "MISROUTED":
        bag["is_rush_bag"] = True
        bag["risk_score"] = 88
        bag["risk_level"] = "HIGH_PRIORITY"
        bag["recommended_action"] = "Reroute via Express Next Flight or Direct Hotel Courier"
        bag["eink_banner"] = "MISROUTED • REROUTING"
    elif status_upper == "MISSING":
        bag["is_rush_bag"] = True
        bag["risk_score"] = 95
        bag["risk_level"] = "HIGH_PRIORITY"
        bag["recommended_action"] = "Active Ramp Trace & Customer Care Escalation"
        bag["eink_banner"] = "RECOVERY IN PROCESS"
    elif status_upper == "RECOVERY_IN_PROGRESS":
        bag["is_rush_bag"] = True
        bag["risk_score"] = 65
        bag["risk_level"] = "MEDIUM"
        bag["recommended_action"] = "Executing Passenger Recovery Preference"
        bag["eink_banner"] = "RECOVERY IN PROCESS"
    elif status_upper in {"LOADED", "ARRIVED", "COLLECTED", "ON_CAROUSEL", "CLAIMED"}:
        bag["is_rush_bag"] = False
        bag["risk_score"] = 12
        bag["risk_level"] = "LOW"
        bag["recommended_action"] = "On schedule"
        bag["eink_banner"] = status_upper.replace("_", " ")
    else:
        bag["is_rush_bag"] = False
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
            "notes": payload.notes or f"Milestone updated to {status_upper}",
        }
    )
    return bag


@router.post("/{tag_number}/passenger/choice")
async def submit_passenger_recovery_choice(tag_number: str, payload: PassengerChoiceRequest) -> dict[str, Any]:
    bag = LIVE_BAGS.get(tag_number)
    if not bag:
        raise HTTPException(status_code=404, detail=f"Baggage tag {tag_number} not found")

    now = datetime.now(UTC).isoformat()
    details = _compute_recovery_details(bag, payload.choice, payload.hotel_address)

    bag["passenger_recovery_choice"] = payload.choice
    bag["recovery_flight_number"] = details["recovery_flight_number"]
    bag["recovery_eta"] = details["recovery_eta"]
    bag["delivery_address"] = details["delivery_address"]
    bag["eink_banner"] = details["eink_banner"]
    bag["status"] = "RECOVERY_IN_PROGRESS"
    bag["updated_at"] = now

    bag["events"].append(
        {
            "id": f"evt_{uuid4().hex[:6]}",
            "event_type": "RECOVERY_IN_PROGRESS",
            "timestamp": now,
            "location_code": "PASSENGER-APP",
            "station_name": "Cathay App Recovery Preference",
            "scanner_type": "APP",
            "notes": details["summary"],
        }
    )
    return bag


@router.post("/risk/predict", response_model=FlightRiskAssessment)
async def predict_mishandling_risk(payload: FlightRiskFeatures) -> FlightRiskAssessment:
    """Public AI Risk Prediction endpoint — backs both pre-flight scoring and trained ML swaps."""
    return ACTIVE_RISK_MODEL.predict(payload)


@router.post("/{tag_number}/risk/apply", response_model=FlightRiskAssessment)
async def apply_mishandling_risk_to_bag(
    tag_number: str, payload: FlightRiskFeatures
) -> FlightRiskAssessment:
    """Runs the AI Risk Model on flight telemetry and pushes the updated risk score & ETA to the passenger."""
    bag = LIVE_BAGS.get(tag_number)
    if not bag:
        raise HTTPException(status_code=404, detail=f"Baggage tag {tag_number} not found")

    assessment = ACTIVE_RISK_MODEL.predict(payload)
    now = datetime.now(UTC).isoformat()
    bag["risk_score"] = assessment.risk_score
    bag["risk_level"] = assessment.risk_level
    bag["risk_factors"] = assessment.factors
    bag["passenger_risk_summary"] = assessment.passenger_summary
    bag["predicted_arrival_time"] = assessment.predicted_arrival_time
    bag["carousel_assigned"] = assessment.carousel_estimate
    bag["model_version"] = assessment.model_version
    bag["recommended_action"] = assessment.recommended_action
    bag["connection_minutes"] = payload.transfer_minutes
    bag["is_rush_bag"] = assessment.risk_level == "HIGH_PRIORITY"
    bag["updated_at"] = now
    return assessment


from pydantic import BaseModel as _PydanticBaseModel
from app.services.risk_engine import FeederFlightInput, FeederFlightPriority


class OutboundHubFlightSummary(_PydanticBaseModel):
    outbound_flight: str
    origin: str
    destination: str
    city_name: str
    scheduled_departure: str
    gate: str
    dest_flight_frequency_pct: float
    total_connecting_bags: int
    total_expected_missed_bags: float
    top_priority_feeder: str
    feeders: list[FeederFlightPriority]


class FeederRankRequest(_PydanticBaseModel):
    outbound_flight: str
    feeders: list[FeederFlightInput]


DEFAULT_HUB_OUTBOUND_SCENARIOS = [
    {
        "outbound_flight": "CX251",
        "origin": "HKG",
        "destination": "LHR",
        "city_name": "London Heathrow",
        "scheduled_departure": "23:55 HKT",
        "gate": "Gate 64",
        "dest_flight_frequency_pct": 15.0,
        "feeders": [
            FeederFlightInput(
                feeder_flight="CX467",
                origin="TPE",
                transfer_bag_count=100,
                inbound_delay_mins=32,
                scheduled_transfer_mins=70,
                weather_impact_score=3,
                airport_congestion_index=3,
                dest_flight_frequency_pct=15.0,
                historical_route_delay_rate=0.34,
            ),
            FeederFlightInput(
                feeder_flight="CX906",
                origin="MNL",
                transfer_bag_count=2,
                inbound_delay_mins=58,
                scheduled_transfer_mins=65,
                weather_impact_score=4,
                airport_congestion_index=4,
                dest_flight_frequency_pct=15.0,
                historical_route_delay_rate=0.48,
            ),
            FeederFlightInput(
                feeder_flight="CX509",
                origin="NRT",
                transfer_bag_count=45,
                inbound_delay_mins=5,
                scheduled_transfer_mins=125,
                weather_impact_score=1,
                airport_congestion_index=2,
                dest_flight_frequency_pct=15.0,
                historical_route_delay_rate=0.14,
            ),
        ],
    },
    {
        "outbound_flight": "CX888",
        "origin": "HKG",
        "destination": "YVR",
        "city_name": "Vancouver",
        "scheduled_departure": "00:30 HKT",
        "gate": "Gate 23",
        "dest_flight_frequency_pct": 12.0,
        "feeders": [
            FeederFlightInput(
                feeder_flight="CX714",
                origin="SIN",
                transfer_bag_count=68,
                inbound_delay_mins=26,
                scheduled_transfer_mins=68,
                weather_impact_score=3,
                airport_congestion_index=3,
                dest_flight_frequency_pct=12.0,
                historical_route_delay_rate=0.28,
            ),
            FeederFlightInput(
                feeder_flight="CX365",
                origin="PVG",
                transfer_bag_count=24,
                inbound_delay_mins=18,
                scheduled_transfer_mins=95,
                weather_impact_score=2,
                airport_congestion_index=4,
                dest_flight_frequency_pct=12.0,
                historical_route_delay_rate=0.31,
            ),
        ],
    },
    {
        "outbound_flight": "CX548",
        "origin": "HKG",
        "destination": "HND",
        "city_name": "Tokyo Haneda",
        "scheduled_departure": "08:45 HKT",
        "gate": "Gate 42",
        "dest_flight_frequency_pct": 65.0,
        "feeders": [
            FeederFlightInput(
                feeder_flight="CX750",
                origin="BKK",
                transfer_bag_count=52,
                inbound_delay_mins=21,
                scheduled_transfer_mins=65,
                weather_impact_score=2,
                airport_congestion_index=3,
                dest_flight_frequency_pct=65.0,
                historical_route_delay_rate=0.25,
            ),
            FeederFlightInput(
                feeder_flight="CX415",
                origin="ICN",
                transfer_bag_count=31,
                inbound_delay_mins=0,
                scheduled_transfer_mins=115,
                weather_impact_score=1,
                airport_congestion_index=2,
                dest_flight_frequency_pct=65.0,
                historical_route_delay_rate=0.16,
            ),
        ],
    },
]


@router.get("/outbound-hub-flights", response_model=list[OutboundHubFlightSummary])
async def list_outbound_hub_flights() -> list[OutboundHubFlightSummary]:
    """Lists outbound HKG flights with their inbound feeder flights ranked by expected missed bags & actionability."""
    summaries: list[OutboundHubFlightSummary] = []
    for item in DEFAULT_HUB_OUTBOUND_SCENARIOS:
        ranked_feeders = ACTIVE_RISK_MODEL.rank_feeders(item["outbound_flight"], item["feeders"])
        total_bags = sum(f.transfer_bag_count for f in ranked_feeders)
        total_exp_missed = round(sum(f.expected_missed_bags for f in ranked_feeders), 1)
        top_feeder = ranked_feeders[0].feeder_flight if ranked_feeders else "N/A"
        summaries.append(
            OutboundHubFlightSummary(
                outbound_flight=item["outbound_flight"],
                origin=item["origin"],
                destination=item["destination"],
                city_name=item["city_name"],
                scheduled_departure=item["scheduled_departure"],
                gate=item["gate"],
                dest_flight_frequency_pct=item["dest_flight_frequency_pct"],
                total_connecting_bags=total_bags,
                total_expected_missed_bags=total_exp_missed,
                top_priority_feeder=top_feeder,
                feeders=ranked_feeders,
            )
        )
    summaries.sort(key=lambda s: s.total_expected_missed_bags, reverse=True)
    return summaries


@router.post("/outbound-hub-flights/rank", response_model=list[FeederFlightPriority])
async def rank_inbound_feeder_flights(payload: FeederRankRequest) -> list[FeederFlightPriority]:
    """Dynamically re-ranks inbound feeder flights for an outbound HKG flight given live telemetry."""
    return ACTIVE_RISK_MODEL.rank_feeders(payload.outbound_flight, payload.feeders)
