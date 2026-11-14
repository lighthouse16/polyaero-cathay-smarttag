from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.baggage import Baggage, Tag
from app.services.baggage import find_tag, normalize_status, record_event
from app.services.dashboard_baggage import (
    apply_assessment,
    ensure_baggage,
    find_baggage,
    load_baggage,
)
from app.services.risk_engine import (
    ACTIVE_RISK_MODEL,
    FeederFlightInput,
    FeederFlightPriority,
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
    weight_kg: float = Field(default=22.4, ge=0)
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
    choice: Literal["EXPRESS_NEXT_FLIGHT", "DIRECT_HOTEL_DELIVERY"]
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
async def list_baggage(db: AsyncSession = Depends(get_db)) -> list[dict[str, Any]]:
    return await load_baggage(db)


@router.post("/reset")
async def reset_demo_state() -> list[dict[str, Any]]:
    raise HTTPException(
        status_code=409, detail="Demo reset is disabled for database-backed baggage"
    )


@router.get("/{tag_number}")
async def get_baggage_by_tag(
    tag_number: str, db: AsyncSession = Depends(get_db)
) -> dict[str, Any]:
    bag = await find_baggage(db, tag_number)
    if bag is None:
        raise HTTPException(status_code=404, detail=f"Baggage tag {tag_number} not found")
    return (await load_baggage(db, bag.id))[0]


async def _writable_baggage(db: AsyncSession, identifier: str) -> tuple[Baggage, Tag]:
    bag = await find_baggage(db, identifier, for_update=True)
    if bag is None:
        raise HTTPException(status_code=404, detail=f"Baggage tag {identifier} not found")
    tag = await db.get(Tag, bag.tag_id) if bag.tag_id else None
    if tag is None:
        raise HTTPException(status_code=409, detail="Baggage has no registered tag")
    return bag, tag


@router.post("/sync")
async def sync_smarttag_from_mobile(
    payload: SyncTagRequest, db: AsyncSession = Depends(get_db)
) -> dict[str, Any]:
    tag = await find_tag(db, payload.tag_code) or await find_tag(db, payload.tag_number)
    if tag is None:
        raise HTTPException(status_code=404, detail="Tag not registered")
    bag = await ensure_baggage(db, tag)
    if bag is None:
        raise HTTPException(status_code=409, detail="Tag has no booked itinerary")
    status_code = payload.initial_status.strip().upper()
    try:
        event_type = (
            "TAG_TAPPED" if status_code == "AWAITING_SYNC" else normalize_status(status_code)
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    assessment = ACTIVE_RISK_MODEL.predict(FlightRiskFeatures(
        flight_number=bag.flight_number,
        origin=bag.departure_airport,
        destination=bag.arrival_airport,
        transfer_minutes=payload.connection_minutes,
        weather_severity=payload.weather_severity,
        load_factor_pct=payload.load_factor_pct,
        airport_congestion=payload.airport_congestion,
    ))
    tag.weight_kg = payload.weight_kg
    if status_code == "AWAITING_SYNC":
        bag.status = tag.tag_status = status_code
        tag.sync_state = "PREPARE"
    else:
        tag.sync_state = "READY"
        tag.last_synced_at = datetime.now(UTC)
        if bag.status in {"AWAITING_SYNC", "UNLINKED"}:
            await record_event(
                db, tag, "TAGGED", location_code="MOBILE-APP", scanner_type="APP"
            )
    apply_assessment(bag, assessment, payload.connection_minutes)
    await record_event(
        db, tag, event_type, location_code="MOBILE-APP",
        station_name="Cathay App SmartTag Sync", scanner_type="APP",
        notes=f"Mobile sync - risk {assessment.risk_score}/100",
    )
    await db.commit()
    return (await load_baggage(db, bag.id))[0]



@router.post("/{tag_number}/scan")
async def record_baggage_scan(
    tag_number: str, payload: ScanEventRequest, db: AsyncSession = Depends(get_db)
) -> dict[str, Any]:
    try:
        event_type = normalize_status(payload.event_type)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    bag, tag = await _writable_baggage(db, tag_number)
    await record_event(
        db, tag, event_type, location_code=payload.location_code,
        station_name=payload.station_name, reader_id=payload.staff_id,
        scanner_type=payload.scanner_type, notes=payload.notes,
    )
    await db.commit()
    return (await load_baggage(db, bag.id))[0]


@router.post("/{tag_number}/passenger/choice")
async def submit_passenger_recovery_choice(
    tag_number: str, payload: PassengerChoiceRequest, db: AsyncSession = Depends(get_db)
) -> dict[str, Any]:
    bag, tag = await _writable_baggage(db, tag_number)
    details = _compute_recovery_details(
        (await load_baggage(db, bag.id))[0], payload.choice, payload.hotel_address
    )
    await record_event(
        db, tag, "RECOVERY_IN_PROGRESS", location_code="PASSENGER-APP",
        station_name="Cathay App Recovery Preference", scanner_type="APP",
        notes=details["summary"],
    )
    bag.operational_data = {
        **(bag.operational_data or {}),
        **{key: value for key, value in details.items() if key != "summary"},
        "passenger_recovery_choice": payload.choice,
    }
    await db.commit()
    return (await load_baggage(db, bag.id))[0]


@router.post("/risk/predict", response_model=FlightRiskAssessment)
async def predict_mishandling_risk(payload: FlightRiskFeatures) -> FlightRiskAssessment:
    """Public AI Risk Prediction endpoint — backs both pre-flight scoring and trained ML swaps."""
    return ACTIVE_RISK_MODEL.predict(payload)


@router.post("/{tag_number}/risk/apply", response_model=FlightRiskAssessment)
async def apply_mishandling_risk_to_bag(
    tag_number: str, payload: FlightRiskFeatures, db: AsyncSession = Depends(get_db)
) -> FlightRiskAssessment:
    """Runs the AI Risk Model on flight telemetry and pushes the updated risk score & ETA to the passenger."""
    bag, _ = await _writable_baggage(db, tag_number)
    assessment = ACTIVE_RISK_MODEL.predict(payload)
    apply_assessment(bag, assessment, payload.transfer_minutes)
    await db.commit()
    return assessment


class OutboundHubFlightSummary(BaseModel):
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


class FeederRankRequest(BaseModel):
    outbound_flight: str
    feeders: list[FeederFlightInput]


DEFAULT_HUB_OUTBOUND_SCENARIOS: list[dict[str, Any]] = [
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
