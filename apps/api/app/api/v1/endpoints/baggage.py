from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import AliasChoices, AwareDatetime, BaseModel, ConfigDict, Field
from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.auth import User
from app.models.baggage import Baggage, BaggageEvent, Tag
from app.models.booking import Booking
from app.models.flight import Flight
from app.services.baggage import MILESTONES, banner_for, find_tag, normalize_status, record_event
from app.services.demo_state import (
    LIVE_BAGS,
    reset_demo_bags,
)
from app.services.risk_engine import (
    ACTIVE_RISK_MODEL,
    FlightRiskAssessment,
    FlightRiskFeatures,
)

router = APIRouter()


class SyncTagRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tag_number: str = "0160892012"
    tag_code: str = "04:A2:3B:4C:5D:6E:70"
    passenger_name: str | None = None
    flight_id: UUID | None = None
    flight_number: str | None = None
    departure_airport: str | None = None
    arrival_airport: str | None = None
    departure_time: AwareDatetime | None = None
    cabin_class: str | None = None
    weight_kg: float = Field(default=22.4, ge=0, allow_inf_nan=False)
    connection_minutes: int = Field(default=85, ge=0)
    sync_status: str | None = Field(
        default=None,
        validation_alias=AliasChoices("sync_status", "initial_status"),
        pattern="^(AWAITING_SYNC|TAGGED|SYNCHRONIZED)$",
    )


async def _database_bags(
    db: AsyncSession, owner_id: UUID, identifier: str | None = None
) -> list[dict[str, Any]]:
    statement = (
        select(Baggage, Tag, Flight, Booking, User)
        .select_from(Baggage)
        .outerjoin(Tag, Tag.id == Baggage.tag_id)
        .join(Flight, Flight.id == Baggage.flight_id)
        .outerjoin(Booking, Booking.id == Tag.booking_id)
        .outerjoin(User, User.id == func.coalesce(Booking.user_id, Tag.user_id))
        .where(
            or_(
                Booking.user_id == owner_id,
                (Booking.id.is_(None)) & (Tag.user_id == owner_id),
            )
        )
        .order_by(Baggage.created_at, Baggage.id)
    )
    if identifier is not None:
        statement = statement.where(
            or_(
                cast(Baggage.id, String) == identifier,
                cast(Tag.id, String) == identifier,
                func.upper(Tag.tag_code) == identifier.upper(),
                Tag.baggage_barcode == identifier,
                Tag.bar_code_payload == identifier,
            )
        )
    rows = (await db.execute(statement)).all()
    tag_ids = [row[1].id for row in rows if row[1] is not None]
    histories: dict[UUID, list[BaggageEvent]] = {}
    if tag_ids:
        for event in await db.scalars(
            select(BaggageEvent)
            .where(BaggageEvent.tag_id.in_(tag_ids))
            .order_by(BaggageEvent.created_at, BaggageEvent.id)
        ):
            histories.setdefault(event.tag_id, []).append(event)
    result = []
    for bag, tag, flight, booking, user in rows:
        number = (
            (tag.baggage_barcode or tag.bar_code_payload or tag.tag_code) if tag else str(bag.id)
        )
        connection = bag.connection_minutes
        assessment = ACTIVE_RISK_MODEL.predict(
            FlightRiskFeatures(
                flight_number=flight.flight_number,
                origin=flight.origin,
                destination=flight.destination,
                transfer_minutes=connection,
                weather_severity=flight.weather_severity,
                load_factor_pct=flight.load_factor_pct,
                airport_congestion=flight.airport_congestion,
                tier_status=user.membership_tier if user else "UNKNOWN",
            )
        )
        history = (
            [event for event in histories.get(tag.id, []) if event.booking_id == tag.booking_id]
            if tag
            else []
        )
        synced = bool(
            tag
            and (
                tag.sync_state == "READY"
                or any(
                    event.event_type == "SYNCHRONIZED" and event.booking_id == tag.booking_id
                    for event in history
                )
            )
        )
        result.append(
            {
                "id": str(bag.id),
                "tag_number": number,
                "tag_code": tag.tag_code if tag else None,
                "flight_id": str(flight.id),
                "booking_reference": booking.pnr if booking else None,
                "passenger_name": bag.passenger_name,
                "tier_status": user.membership_tier if user else None,
                "cabin_class": booking.cabin_class if booking else None,
                "flight_number": flight.flight_number,
                "departure_airport": flight.origin,
                "arrival_airport": flight.destination,
                "departure_time": flight.departure_time.isoformat(),
                "weather_severity": flight.weather_severity,
                "load_factor_pct": flight.load_factor_pct,
                "airport_congestion": flight.airport_congestion,
                "initial_status": flight.initial_status,
                "seat_number": bag.seat_number,
                "weight_kg": tag.weight_kg if tag else None,
                "connection_minutes": connection,
                "status": bag.status.upper(),
                "is_tag_synced": synced,
                "tag_interface": "E-Ink SmartTag",
                "last_known_location": history[-1].location_code if history else None,
                "carousel_assigned": assessment.carousel_estimate,
                "is_rush_bag": bag.status.upper()
                in {"MISROUTED", "MISSING", "RECOVERY_IN_PROGRESS"}
                or assessment.risk_level == "HIGH_PRIORITY",
                "risk_score": assessment.risk_score,
                "risk_level": assessment.risk_level,
                "risk_factors": assessment.factors,
                "passenger_risk_summary": assessment.passenger_summary,
                "predicted_arrival_time": assessment.predicted_arrival_time,
                "model_version": assessment.model_version,
                "recommended_action": assessment.recommended_action,
                "eink_banner": banner_for(bag.status),
                "updated_at": bag.updated_at.isoformat(),
                "events": [
                    {
                        "id": str(event.id),
                        "event_type": event.event_type,
                        "timestamp": event.created_at.isoformat(),
                        "location_code": event.location_code,
                        "station_name": event.station_name,
                        "scanner_type": event.scanner_type,
                        "notes": event.notes,
                    }
                    for event in history
                ],
            }
        )
    return result


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


def _compute_recovery_details(
    bag: dict[str, Any], choice: str, hotel_address: str | None
) -> dict[str, Any]:
    now = datetime.now(UTC)
    orig_flight = bag.get("flight_number", "CX548")
    dest = bag.get("arrival_airport", "HND")

    if choice == "EXPRESS_NEXT_FLIGHT":
        next_flight = (
            "CX524" if orig_flight == "CX548" else ("CX890" if orig_flight == "CX888" else "CX257")
        )
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
async def list_baggage(
    response: Response,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    response.headers["Cache-Control"] = "no-store"
    return await _database_bags(db, current_user.id)


@router.post("/reset")
async def reset_demo_state() -> list[dict[str, Any]]:
    return reset_demo_bags()


@router.get("/{tag_number}")
async def get_baggage_by_tag(
    tag_number: str,
    response: Response,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    response.headers["Cache-Control"] = "no-store"
    persisted = await _database_bags(db, current_user.id, tag_number)
    if persisted:
        return persisted[0]
    raise HTTPException(status_code=404, detail="Baggage not found")


@router.post("/sync")
async def sync_smarttag_from_mobile(
    payload: SyncTagRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    response.headers["Cache-Control"] = "no-store"
    tag = await find_tag(db, payload.tag_code) or await find_tag(db, payload.tag_number)
    if tag is None:
        raise HTTPException(status_code=404, detail="SmartTag not found")
    booking = await db.get(Booking, tag.booking_id) if tag.booking_id else None
    if not tag.is_active or (
        booking.user_id != current_user.id if booking else tag.user_id != current_user.id
    ):
        raise HTTPException(status_code=404, detail="SmartTag not found")
    flight_id = payload.flight_id or (booking.flight_id if booking else None)
    if booking and flight_id != booking.flight_id:
        raise HTTPException(status_code=409, detail="Flight does not match the tag's booking")
    if flight_id is not None:
        flight = await db.get(Flight, flight_id)
    elif payload.flight_number and payload.departure_airport and payload.arrival_airport:
        statement = select(Flight).where(
            func.upper(Flight.flight_number) == payload.flight_number.strip().upper(),
            Flight.origin == payload.departure_airport.strip().upper(),
            Flight.destination == payload.arrival_airport.strip().upper(),
        )
        if payload.departure_time is not None:
            statement = statement.where(Flight.departure_time == payload.departure_time)
        candidates = (await db.scalars(statement.limit(2))).all()
        if len(candidates) > 1:
            raise HTTPException(
                status_code=409, detail="Multiple departures match; supply flight_id"
            )
        flight = candidates[0] if candidates else None
    else:
        raise HTTPException(status_code=422, detail="Supply flight_id or a tag linked to a booking")
    if flight is None:
        raise HTTPException(status_code=404, detail="Flight not found")
    for supplied, stored in (
        (payload.flight_number, flight.flight_number),
        (payload.departure_airport, flight.origin),
        (payload.arrival_airport, flight.destination),
    ):
        if supplied and supplied.strip().upper() != stored.upper():
            raise HTTPException(status_code=409, detail="Supplied route does not match the flight")
    if payload.departure_time is not None and payload.departure_time != flight.departure_time:
        raise HTTPException(status_code=409, detail="Supplied departure does not match the flight")
    bag = await db.scalar(select(Baggage).where(Baggage.tag_id == tag.id).with_for_update())
    if bag is None:
        bag = Baggage(
            tag_id=tag.id,
            flight_id=flight.id,
            passenger_name=payload.passenger_name or "",
            status=tag.tag_status if tag.tag_status in MILESTONES else flight.initial_status,
        )
        db.add(bag)
    elif bag.flight_id != flight.id:
        raise HTTPException(status_code=409, detail="Baggage is already linked to another flight")
    if booking and booking.user_id:
        user = await db.get(User, booking.user_id)
        if user:
            bag.passenger_name = " ".join(filter(None, (user.family_name, user.given_names)))
    tag.weight_kg = payload.weight_kg
    if "connection_minutes" in payload.model_fields_set:
        bag.connection_minutes = payload.connection_minutes
    await db.flush()
    confirmed = payload.sync_status in {"TAGGED", "SYNCHRONIZED"}
    if confirmed and bag.status.upper() in {"AWAITING_SYNC", "CHECKED_IN"}:
        bag.status = "TAGGED"
        tag.tag_status = "TAGGED"
    await record_event(
        db,
        tag,
        "SYNCHRONIZED" if confirmed else "TAG_TAPPED",
        location_code="MOBILE-APP",
        station_name="Cathay App SmartTag Sync",
        scanner_type="APP",
    )
    number = tag.baggage_barcode or tag.bar_code_payload or tag.tag_code
    owner_id = current_user.id
    await db.commit()
    return (await _database_bags(db, owner_id, number))[0]


@router.post("/{tag_number}/scan")
async def record_baggage_scan(
    tag_number: str, payload: ScanEventRequest, db: AsyncSession = Depends(get_db)
) -> dict[str, Any]:
    bag = LIVE_BAGS.get(tag_number)
    if not bag or "events" not in bag:
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

    tag = await find_tag(db, tag_number)
    if tag is not None:
        try:
            event_type = normalize_status(status_upper)
        except ValueError:
            event_type = "TAG_TAPPED"
        await record_event(
            db,
            tag,
            event_type,
            location_code=payload.location_code,
            station_name=payload.station_name,
            reader_id=payload.staff_id,
            scanner_type=payload.scanner_type,
            notes=payload.notes or f"Mirrored staff scan: {status_upper}",
        )
        await db.commit()

    return bag


@router.post("/{tag_number}/passenger/choice")
async def submit_passenger_recovery_choice(
    tag_number: str, payload: PassengerChoiceRequest
) -> dict[str, Any]:
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
