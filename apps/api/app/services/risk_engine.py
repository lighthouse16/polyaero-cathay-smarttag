from abc import ABC, abstractmethod
from datetime import UTC, datetime, timedelta
from pathlib import Path
import joblib
import pandas as pd
from pydantic import BaseModel

ARTIFACT_PATH = Path(__file__).resolve().parent.parent.parent / "artifacts" / "cathay_bag_risk_bundle.joblib"


class FlightRiskFeatures(BaseModel):
    flight_number: str
    origin: str
    destination: str
    transfer_minutes: int = 75
    weather_severity: int = 2        # 1 (clear) to 5 (typhoon/severe)
    load_factor_pct: float = 85.0    # 0 to 100%
    airport_congestion: int = 2      # 1 (low) to 5 (peak)
    tier_status: str = "DIAMOND"


class FlightRiskAssessment(BaseModel):
    model_version: str
    risk_score: int
    risk_level: str                  # LOW | MEDIUM | HIGH_PRIORITY
    priority_sequence: int
    recommended_action: str
    passenger_summary: str
    predicted_arrival_time: str
    carousel_estimate: str
    factors: list[str]


class BaggageRiskModelInterface(ABC):
    @property
    @abstractmethod
    def model_version(self) -> str:
        ...

    @abstractmethod
    def predict(self, features: FlightRiskFeatures) -> FlightRiskAssessment:
        ...


class HeuristicBaselineRiskModel(BaggageRiskModelInterface):
    @property
    def model_version(self) -> str:
        return "cathay-bag-risk-v1.0-heuristic"

    def predict(self, features: FlightRiskFeatures) -> FlightRiskAssessment:
        score = 12
        factors: list[str] = []

        if features.transfer_minutes < 45:
            score += 42
            factors.append(f"Tight connection window ({features.transfer_minutes} mins)")
        elif features.transfer_minutes < 70:
            score += 20
            factors.append(f"Moderate transfer buffer ({features.transfer_minutes} mins)")
        else:
            factors.append(f"Healthy connection buffer ({features.transfer_minutes} mins)")

        if features.weather_severity >= 4:
            score += 24
            factors.append(f"Adverse route weather (Severity {features.weather_severity}/5)")
        elif features.weather_severity == 3:
            score += 10
            factors.append("Moderate en-route weather")

        if features.airport_congestion >= 4:
            score += 14
            factors.append(f"Peak terminal BHS congestion ({features.airport_congestion}/5)")

        if features.load_factor_pct >= 92:
            score += 10
            factors.append(f"High cabin/cargo load ({features.load_factor_pct:.0f}%)")

        score = max(5, min(98, score))
        route_hours = {
            ("HKG", "HND"): 4.2,
            ("HKG", "NRT"): 4.4,
            ("HKG", "YVR"): 11.8,
            ("HKG", "LHR"): 13.5,
            ("HKG", "NKG"): 2.6,
        }.get((features.origin.upper(), features.destination.upper()), 4.5)

        eta_dt = datetime.now(UTC) + timedelta(hours=route_hours, minutes=22)
        eta_str = eta_dt.strftime("%d %b, %H:%M Local")
        carousel = "Belt 7" if features.destination.upper() in {"HND", "NRT"} else "Belt 4"

        return _format_assessment(self.model_version, score, eta_str, carousel, factors, features.flight_number)


class TrainedGradientBoostingRiskModel(BaggageRiskModelInterface):
    def __init__(self, bundle_path: Path):
        bundle = joblib.load(bundle_path)
        self.clf = bundle["classifier"]
        self.reg = bundle["regressor"]
        self.feature_cols = bundle["features"]

    @property
    def model_version(self) -> str:
        return "cathay-bag-risk-v2.0-hgb-bts"

    def predict(self, features: FlightRiskFeatures) -> FlightRiskAssessment:
        route_mins = {
            ("HKG", "HND"): 250.0,
            ("HKG", "NRT"): 265.0,
            ("HKG", "YVR"): 710.0,
            ("HKG", "LHR"): 810.0,
            ("HKG", "NKG"): 155.0,
        }.get((features.origin.upper(), features.destination.upper()), 260.0)

        row = pd.DataFrame([{
            "transfer_minutes": features.transfer_minutes,
            "weather_severity": features.weather_severity,
            "load_factor_pct": features.load_factor_pct,
            "airport_congestion": features.airport_congestion,
            "scheduled_flight_mins": route_mins,
        }])[self.feature_cols]

        prob = float(self.clf.predict_proba(row)[0, 1])
        score = max(5, min(98, int(round(prob * 100))))
        predicted_transit_mins = float(self.reg.predict(row)[0])

        eta_dt = datetime.now(UTC) + timedelta(minutes=predicted_transit_mins)
        eta_str = eta_dt.strftime("%d %b, %H:%M Local")
        carousel = "Belt 7" if features.destination.upper() in {"HND", "NRT"} else "Belt 4"

        factors: list[str] = [
            f"Transfer window: {features.transfer_minutes} mins",
            f"Route weather index: {features.weather_severity}/5",
            f"Hub congestion index: {features.airport_congestion}/5",
            f"Load factor: {features.load_factor_pct:.0f}%",
        ]
        return _format_assessment(self.model_version, score, eta_str, carousel, factors, features.flight_number)


def _format_assessment(
    version: str,
    score: int,
    eta_str: str,
    carousel: str,
    factors: list[str],
    flight_number: str,
) -> FlightRiskAssessment:
    if score >= 65:
        level = "HIGH_PRIORITY"
        seq = 1
        action = "Priority Sequence #1 · Tail-to-tail ramp intercept"
        pax_msg = f"Priority transfer protection active for {flight_number} (Score {score}/100)."
    elif score >= 35:
        level = "MEDIUM"
        seq = 2
        action = "Priority Sequence #2 · Monitored BHS sortation"
        pax_msg = f"Standard transfer window on {flight_number} — actively monitored."
    else:
        level = "LOW"
        seq = 3
        action = "Priority Sequence #3 · Normal automated BHS routing"
        pax_msg = f"Smooth connection outlook on {flight_number}."

    return FlightRiskAssessment(
        model_version=version,
        risk_score=score,
        risk_level=level,
        priority_sequence=seq,
        recommended_action=action,
        passenger_summary=pax_msg,
        predicted_arrival_time=eta_str,
        carousel_estimate=carousel,
        factors=factors,
    )


def _load_active_model() -> BaggageRiskModelInterface:
    if ARTIFACT_PATH.exists():
        try:
            return TrainedGradientBoostingRiskModel(ARTIFACT_PATH)
        except Exception:
            pass
    return HeuristicBaselineRiskModel()


ACTIVE_RISK_MODEL: BaggageRiskModelInterface = _load_active_model()
