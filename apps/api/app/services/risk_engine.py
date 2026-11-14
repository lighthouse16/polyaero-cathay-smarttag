from abc import ABC, abstractmethod
from datetime import UTC, datetime, timedelta
from pathlib import Path
import joblib
import pandas as pd
from pydantic import BaseModel

ARTIFACT_PATH = Path(__file__).resolve().parent.parent.parent / "artifacts" / "cathay_bag_risk_bundle.joblib"


def mask_bag_tag(tag_number: str) -> str:
    clean = (tag_number or "").strip()
    if len(clean) <= 6:
        return clean
    return f"{clean[:4]}••••{clean[-2:]}"


class FlightRiskFeatures(BaseModel):
    flight_number: str
    origin: str
    destination: str
    transfer_minutes: int = 75
    weather_severity: int = 2
    load_factor_pct: float = 85.0
    airport_congestion: int = 2
    tier_status: str = "DIAMOND"
    inbound_delay_mins: int = 0
    dest_flight_frequency_pct: float = 20.0
    historical_route_delay_rate: float = 0.22
    transfer_bag_count: int = 1
    transfer_scan_detected: bool = False


class FlightRiskAssessment(BaseModel):
    model_version: str
    risk_score: int
    risk_level: str                  # ON_TRACK | AT_RISK | ACTION_REQUIRED
    priority_sequence: int
    time_to_act_mins: int
    recommended_action: str
    expected_outcome: str
    passenger_summary: str
    predicted_arrival_time: str
    carousel_estimate: str
    factors: list[str]
    expected_missed_bags: float = 0.0
    priority_index: float = 0.0
    dispatch_mode: str = "PRIORITY_BHS_CHUTE"


class FeederFlightInput(BaseModel):
    feeder_flight: str
    origin: str
    transfer_bag_count: int
    inbound_delay_mins: int
    scheduled_transfer_mins: int
    weather_impact_score: int
    airport_congestion_index: int
    dest_flight_frequency_pct: float
    historical_route_delay_rate: float


class FeederFlightPriority(BaseModel):
    rank: int = 0
    feeder_flight: str
    origin: str
    transfer_bag_count: int
    risk_score: int
    time_to_act_mins: int
    expected_missed_bags: float
    priority_index: float
    dispatch_mode: str
    recommended_action: str
    expected_outcome: str
    effective_buffer_mins: int
    bhs_transfer_mins: float


class BaggageRiskModelInterface(ABC):
    @property
    @abstractmethod
    def model_version(self) -> str:
        ...

    @abstractmethod
    def predict(self, features: FlightRiskFeatures) -> FlightRiskAssessment:
        ...

    @abstractmethod
    def rank_feeders(self, outbound_flight: str, feeders: list[FeederFlightInput]) -> list[FeederFlightPriority]:
        ...


def compute_copilot_decision(
    bag_count: int,
    miss_prob: float,
    effective_buffer: float,
    bhs_transfer_mins: float,
    dest_freq_pct: float,
) -> tuple[float, float, int, str, str, str]:
    expected_missed = round(bag_count * miss_prob, 1)
    scarcity_mult = 1.0 + 0.5 * (1.0 - max(0.0, min(100.0, dest_freq_pct)) / 100.0)

    # Time to Act = remaining slack before manual intercept misses the 15-min loading cutoff
    time_to_act = max(2, int(round(effective_buffer - 18)))

    if effective_buffer < 12:
        recoverability = 0.35
        mode = "AUTO_REBOOK_DIGITAL_RECOVERY"
        action = "Trigger proactive next-flight rebooking & passenger alert"
        outcome = "Bag automatically routed to next available departure with zero counter queue."
    elif effective_buffer <= 52 or miss_prob >= 0.45:
        recoverability = 1.25
        mode = "TAIL_TO_TAIL_RAMP_VAN"
        action = "Prioritise manual baggage transfer"
        outcome = "Bag can reach the onward-flight loading cutoff."
    else:
        recoverability = 0.85
        mode = "PRIORITY_BHS_CHUTE"
        action = "Continue automated BHS transfer monitoring"
        outcome = f"Expected to clear HKG BHS in ~{int(round(bhs_transfer_mins))} min well ahead of cutoff."

    priority_index = round(expected_missed * scarcity_mult * recoverability, 1)
    return expected_missed, priority_index, time_to_act, mode, action, outcome


class HeuristicBaselineRiskModel(BaggageRiskModelInterface):
    @property
    def model_version(self) -> str:
        return "cathay-bag-risk-v1.0-heuristic"

    def predict(self, features: FlightRiskFeatures) -> FlightRiskAssessment:
        eff_buf = features.transfer_minutes - max(0, features.inbound_delay_mins)
        raw = 25 + max(0, 65 - eff_buf) + (features.weather_severity - 1) * 9 + (features.airport_congestion - 1) * 6
        score = max(5, min(98, int(raw)))
        exp_missed, p_idx, time_to_act, mode, action, outcome = compute_copilot_decision(
            features.transfer_bag_count, score / 100.0, eff_buf, 26.0, features.dest_flight_frequency_pct
        )
        eta_str = (datetime.now(UTC) + timedelta(hours=4, minutes=20)).strftime("%d %b, %H:%M Local")
        reasons = _build_plain_reasons(features.inbound_delay_mins, eff_buf, features.transfer_scan_detected, features.weather_severity)
        return _format_assessment(
            self.model_version, score, time_to_act, eta_str, "Belt 7", reasons,
            features.flight_number, exp_missed, p_idx, mode, action, outcome
        )

    def rank_feeders(self, outbound_flight: str, feeders: list[FeederFlightInput]) -> list[FeederFlightPriority]:
        results: list[FeederFlightPriority] = []
        for f in feeders:
            eff_buf = f.scheduled_transfer_mins - max(0, f.inbound_delay_mins)
            score = max(5, min(98, int(30 + max(0, 65 - eff_buf) + (f.weather_impact_score - 1) * 8)))
            exp_missed, p_idx, time_to_act, mode, action, outcome = compute_copilot_decision(
                f.transfer_bag_count, score / 100.0, eff_buf, 28.0, f.dest_flight_frequency_pct
            )
            results.append(
                FeederFlightPriority(
                    feeder_flight=f.feeder_flight,
                    origin=f.origin,
                    transfer_bag_count=f.transfer_bag_count,
                    risk_score=score,
                    time_to_act_mins=time_to_act,
                    expected_missed_bags=exp_missed,
                    priority_index=p_idx,
                    dispatch_mode=mode,
                    recommended_action=action,
                    expected_outcome=outcome,
                    effective_buffer_mins=eff_buf,
                    bhs_transfer_mins=28.0,
                )
            )
        results.sort(key=lambda r: r.priority_index, reverse=True)
        for i, r in enumerate(results, 1):
            r.rank = i
        return results


class TrainedHubFeederRiskModel(BaggageRiskModelInterface):
    def __init__(self, bundle_path: Path):
        bundle = joblib.load(bundle_path)
        self.clf = bundle["classifier"]
        self.reg = bundle["regressor"]
        self.feature_cols = bundle["features"]

    @property
    def model_version(self) -> str:
        return "cathay-bag-risk-v3.0-hkg-feeder"

    def predict(self, features: FlightRiskFeatures) -> FlightRiskAssessment:
        inferred_delay = features.inbound_delay_mins
        if inferred_delay == 0 and features.transfer_minutes < 55:
            inferred_delay = max(0, 62 - features.transfer_minutes)

        row = pd.DataFrame([{
            "inbound_delay_mins": inferred_delay,
            "scheduled_transfer_mins": features.transfer_minutes,
            "weather_impact_score": float(features.weather_severity),
            "airport_congestion_index": float(features.airport_congestion),
            "dest_flight_frequency_pct": float(features.dest_flight_frequency_pct),
            "historical_route_delay_rate": float(features.historical_route_delay_rate),
        }])[self.feature_cols]

        prob = float(self.clf.predict_proba(row)[0, 1])
        score = max(4, min(98, int(round(prob * 100))))
        bhs_mins = float(self.reg.predict(row)[0])

        eff_buf = features.transfer_minutes - max(0, inferred_delay)
        exp_missed, p_idx, time_to_act, mode, action, outcome = compute_copilot_decision(
            features.transfer_bag_count, prob, eff_buf, bhs_mins, features.dest_flight_frequency_pct
        )

        route_mins = {
            ("HKG", "HND"): 250.0,
            ("HKG", "NRT"): 265.0,
            ("HKG", "YVR"): 710.0,
            ("HKG", "LHR"): 810.0,
            ("HKG", "NKG"): 155.0,
        }.get((features.origin.upper(), features.destination.upper()), 260.0)

        eta_dt = datetime.now(UTC) + timedelta(minutes=route_mins + bhs_mins)
        eta_str = eta_dt.strftime("%d %b, %H:%M Local")
        carousel = "Belt 7" if features.destination.upper() in {"HND", "NRT"} else "Belt 4"

        reasons = _build_plain_reasons(inferred_delay, eff_buf, features.transfer_scan_detected, features.weather_severity)
        return _format_assessment(
            self.model_version, score, time_to_act, eta_str, carousel, reasons,
            features.flight_number, exp_missed, p_idx, mode, action, outcome
        )

    def rank_feeders(self, outbound_flight: str, feeders: list[FeederFlightInput]) -> list[FeederFlightPriority]:
        if not feeders:
            return []

        df = pd.DataFrame([
            {
                "inbound_delay_mins": f.inbound_delay_mins,
                "scheduled_transfer_mins": f.scheduled_transfer_mins,
                "weather_impact_score": float(f.weather_impact_score),
                "airport_congestion_index": float(f.airport_congestion_index),
                "dest_flight_frequency_pct": float(f.dest_flight_frequency_pct),
                "historical_route_delay_rate": float(f.historical_route_delay_rate),
            }
            for f in feeders
        ])[self.feature_cols]

        probs = self.clf.predict_proba(df)[:, 1]
        bhs_times = self.reg.predict(df)

        results: list[FeederFlightPriority] = []
        for f, prob, bhs_mins in zip(feeders, probs, bhs_times):
            eff_buf = f.scheduled_transfer_mins - max(0, f.inbound_delay_mins)
            score = max(4, min(98, int(round(float(prob) * 100))))
            exp_missed, p_idx, time_to_act, mode, action, outcome = compute_copilot_decision(
                f.transfer_bag_count, float(prob), eff_buf, float(bhs_mins), f.dest_flight_frequency_pct
            )
            results.append(
                FeederFlightPriority(
                    feeder_flight=f.feeder_flight,
                    origin=f.origin,
                    transfer_bag_count=f.transfer_bag_count,
                    risk_score=score,
                    time_to_act_mins=time_to_act,
                    expected_missed_bags=exp_missed,
                    priority_index=p_idx,
                    dispatch_mode=mode,
                    recommended_action=action,
                    expected_outcome=outcome,
                    effective_buffer_mins=eff_buf,
                    bhs_transfer_mins=round(float(bhs_mins), 1),
                )
            )

        results.sort(key=lambda r: r.priority_index, reverse=True)
        for i, r in enumerate(results, 1):
            r.rank = i
        return results


def _build_plain_reasons(delay_mins: int, eff_buf: int, scan_detected: bool, weather_sev: int) -> list[str]:
    reasons: list[str] = []
    if delay_mins > 0:
        reasons.append(f"Incoming flight delayed {delay_mins} min")
    reasons.append(f"Only {max(0, eff_buf)} min connection remaining")
    if not scan_detected:
        reasons.append("Transfer scan not detected")
    if weather_sev >= 3:
        reasons.append(f"Weather slowdown at hub (Level {weather_sev}/5)")
    return reasons


def _format_assessment(
    version: str,
    score: int,
    time_to_act: int,
    eta_str: str,
    carousel: str,
    factors: list[str],
    flight_number: str,
    exp_missed: float,
    p_idx: float,
    mode: str,
    action: str,
    outcome: str,
) -> FlightRiskAssessment:
    if score >= 65:
        level = "ACTION_REQUIRED"
        seq = 1
        pax_msg = f"Priority transfer recovery active for {flight_number} (Risk {score}/100)."
    elif score >= 35:
        level = "AT_RISK"
        seq = 2
        pax_msg = f"Connection window on {flight_number} is actively monitored by HKG Transfer Control."
    else:
        level = "ON_TRACK"
        seq = 3
        pax_msg = f"Smooth connection outlook on {flight_number}."

    return FlightRiskAssessment(
        model_version=version,
        risk_score=score,
        risk_level=level,
        priority_sequence=seq,
        time_to_act_mins=time_to_act,
        recommended_action=action,
        expected_outcome=outcome,
        passenger_summary=pax_msg,
        predicted_arrival_time=eta_str,
        carousel_estimate=carousel,
        factors=factors,
        expected_missed_bags=exp_missed,
        priority_index=p_idx,
        dispatch_mode=mode,
    )


def _load_active_model() -> BaggageRiskModelInterface:
    if ARTIFACT_PATH.exists():
        try:
            return TrainedHubFeederRiskModel(ARTIFACT_PATH)
        except Exception:
            pass
    return HeuristicBaselineRiskModel()


ACTIVE_RISK_MODEL: BaggageRiskModelInterface = _load_active_model()
