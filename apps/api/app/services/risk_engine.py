from abc import ABC, abstractmethod
from datetime import UTC, datetime, timedelta
from pydantic import BaseModel


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
    """
    Standard interface for Cathay Baggage Mishandling Risk Models.
    Swap `HeuristicBaselineRiskModel` with your trained ML artifact
    (e.g., XGBoost / LightGBM / PyTorch) by implementing `predict()`.
    """

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
        return "cathay-bag-risk-v1.0-interface"

    def predict(self, features: FlightRiskFeatures) -> FlightRiskAssessment:
        score = 12
        factors: list[str] = []

        # 1. Connection / transfer buffer risk
        if features.transfer_minutes < 45:
            score += 42
            factors.append(f"Tight connection window ({features.transfer_minutes} mins)")
        elif features.transfer_minutes < 70:
            score += 20
            factors.append(f"Moderate transfer buffer ({features.transfer_minutes} mins)")
        else:
            factors.append(f"Healthy connection buffer ({features.transfer_minutes} mins)")

        # 2. Weather & hub congestion
        if features.weather_severity >= 4:
            score += 24
            factors.append(f"Adverse route weather (Severity {features.weather_severity}/5)")
        elif features.weather_severity == 3:
            score += 10
            factors.append("Moderate en-route weather")

        if features.airport_congestion >= 4:
            score += 14
            factors.append(f"Peak terminal BHS congestion ({features.airport_congestion}/5)")

        # 3. Aircraft load factor
        if features.load_factor_pct >= 92:
            score += 10
            factors.append(f"High cabin/cargo load ({features.load_factor_pct:.0f}%)")

        score = max(5, min(98, score))

        # Flight duration estimate for arrival prediction
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

        if score >= 65:
            level = "HIGH_PRIORITY"
            seq = 1
            action = "Flag for priority tail-to-tail ramp transfer"
            pax_msg = f"High-priority transfer protection active for {features.flight_number}."
        elif score >= 35:
            level = "MEDIUM"
            seq = 2
            action = "Monitor BHS sortation & standard ULD load"
            pax_msg = f"Standard transfer window on {features.flight_number} — actively monitored."
        else:
            level = "LOW"
            seq = 3
            action = "Normal automated BHS routing"
            pax_msg = f"Smooth connection outlook on {features.flight_number}."

        return FlightRiskAssessment(
            model_version=self.model_version,
            risk_score=score,
            risk_level=level,
            priority_sequence=seq,
            recommended_action=action,
            passenger_summary=pax_msg,
            predicted_arrival_time=eta_str,
            carousel_estimate=carousel,
            factors=factors,
        )


# Active singleton predictor — replace with TrainedMLRiskModel() once weights are trained
ACTIVE_RISK_MODEL: BaggageRiskModelInterface = HeuristicBaselineRiskModel()
