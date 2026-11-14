import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor
from sklearn.calibration import CalibratedClassifierCV
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, mean_absolute_error

BASE_DIR = Path(__file__).resolve().parent.parent
ARTIFACT_PATH = BASE_DIR / "artifacts" / "cathay_bag_risk_bundle.joblib"


def build_hkg_feeder_dataset(n: int = 50_000, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)

    scheduled_transfer = rng.integers(40, 210, size=n)
    historical_delay_rate = rng.uniform(0.08, 0.55, size=n)
    weather_score = rng.choice([1, 2, 3, 4, 5], p=[0.42, 0.26, 0.16, 0.10, 0.06], size=n)
    congestion_idx = rng.choice([1, 2, 3, 4, 5], p=[0.18, 0.32, 0.26, 0.16, 0.08], size=n)
    dest_freq_pct = rng.choice([12.0, 20.0, 35.0, 60.0, 85.0], p=[0.25, 0.25, 0.20, 0.15, 0.15], size=n)

    base_delay = (
        (weather_score - 1) * 11.5
        + (congestion_idx - 1) * 4.0
        + historical_delay_rate * 28.0
        + rng.normal(-4.0, 12.0, size=n)
    )
    inbound_delay = np.clip(np.round(base_delay), -10, 130).astype(int)

    effective_buffer = scheduled_transfer - np.maximum(0, inbound_delay) - (congestion_idx - 1) * 3.5

    logit = (46.0 - effective_buffer) / 11.5 + (weather_score - 2.5) * 0.25
    true_miss_prob = 1.0 / (1.0 + np.exp(-logit))
    missed_connection = (rng.uniform(0, 1, size=n) < true_miss_prob).astype(int)

    bhs_transfer_mins = (
        24.0
        + (congestion_idx - 1) * 4.5
        + (weather_score - 1) * 3.0
        + rng.normal(0, 4.0, size=n)
    )

    return pd.DataFrame({
        "inbound_delay_mins": inbound_delay,
        "scheduled_transfer_mins": scheduled_transfer,
        "weather_impact_score": weather_score.astype(float),
        "airport_congestion_index": congestion_idx.astype(float),
        "dest_flight_frequency_pct": dest_freq_pct,
        "historical_route_delay_rate": historical_delay_rate,
        "missed_connection": missed_connection,
        "bhs_transfer_mins": np.clip(bhs_transfer_mins, 15.0, 85.0),
    })


def rank_feeder_flight(
    bag_count: int,
    miss_prob: float,
    effective_buffer: float,
    dest_freq_pct: float,
) -> dict:
    expected_missed = bag_count * miss_prob
    scarcity_mult = 1.0 + 0.5 * (1.0 - dest_freq_pct / 100.0)

    if effective_buffer < 10:
        recoverability = 0.35
        dispatch_mode = "AUTO_REBOOK_DIGITAL_RECOVERY"
    elif effective_buffer <= 50:
        recoverability = 1.25
        dispatch_mode = "TAIL_TO_TAIL_RAMP_VAN"
    else:
        recoverability = 0.85
        dispatch_mode = "PRIORITY_BHS_CHUTE"

    priority_index = round(expected_missed * scarcity_mult * recoverability, 1)
    return {
        "bag_count": bag_count,
        "risk_pct": round(miss_prob * 100),
        "expected_missed_bags": round(expected_missed, 1),
        "priority_index": priority_index,
        "dispatch_mode": dispatch_mode,
    }


def main():
    df = build_hkg_feeder_dataset()
    feature_cols = [
        "inbound_delay_mins",
        "scheduled_transfer_mins",
        "weather_impact_score",
        "airport_congestion_index",
        "dest_flight_frequency_pct",
        "historical_route_delay_rate",
    ]
    X = df[feature_cols]

    X_train, X_test, y_cls_train, y_cls_test = train_test_split(
        X, df["missed_connection"], test_size=0.2, random_state=42
    )
    base_clf = HistGradientBoostingClassifier(max_depth=5, learning_rate=0.05, min_samples_leaf=80, random_state=42)
    clf = CalibratedClassifierCV(base_clf, method="sigmoid", cv=3)
    clf.fit(X_train, y_cls_train)
    auc = roc_auc_score(y_cls_test, clf.predict_proba(X_test)[:, 1])

    _, _, y_reg_train, y_reg_test = train_test_split(
        X, df["bhs_transfer_mins"], test_size=0.2, random_state=42
    )
    reg = HistGradientBoostingRegressor(max_depth=5, learning_rate=0.05, random_state=42)
    reg.fit(X_train, y_reg_train)
    mae = mean_absolute_error(y_reg_test, reg.predict(X_test))

    ARTIFACT_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(
        {"classifier": clf, "regressor": reg, "features": feature_cols, "schema": "hkg-hub-feeder-v3"},
        ARTIFACT_PATH,
    )
    print(f"Saved HKG Hub Feeder model -> {ARTIFACT_PATH}")
    print(f"Validation ROC-AUC: {auc:.3f} | BHS Transfer Time MAE: {mae:.1f} mins\n")

    demo_feeders = [
        {"flight": "CX467 (TPE->HKG)", "bags": 100, "inbound_delay_mins": 32, "scheduled_transfer_mins": 70, "weather_impact_score": 3.0, "airport_congestion_index": 3.0, "dest_flight_frequency_pct": 15.0, "historical_route_delay_rate": 0.34},
        {"flight": "CX906 (MNL->HKG)", "bags": 2,   "inbound_delay_mins": 58, "scheduled_transfer_mins": 65, "weather_impact_score": 4.0, "airport_congestion_index": 4.0, "dest_flight_frequency_pct": 15.0, "historical_route_delay_rate": 0.48},
        {"flight": "CX509 (NRT->HKG)", "bags": 45,  "inbound_delay_mins": 5,  "scheduled_transfer_mins": 125,"weather_impact_score": 1.0, "airport_congestion_index": 2.0, "dest_flight_frequency_pct": 15.0, "historical_route_delay_rate": 0.14},
    ]
    sample_X = pd.DataFrame(demo_feeders)[feature_cols]
    probs = clf.predict_proba(sample_X)[:, 1]

    ranked = []
    for row, p in zip(demo_feeders, probs):
        eff_buf = row["scheduled_transfer_mins"] - max(0, row["inbound_delay_mins"])
        res = rank_feeder_flight(row["bags"], float(p), eff_buf, row["dest_flight_frequency_pct"])
        ranked.append({"flight": row["flight"], **res})

    ranked.sort(key=lambda x: x["priority_index"], reverse=True)
    for idx, item in enumerate(ranked, 1):
        print(f"Rank #{idx}: {item['flight']} | {item['bag_count']} bags @ {item['risk_pct']}% risk -> Exp. Missed: {item['expected_missed_bags']} | Priority Index: {item['priority_index']} ({item['dispatch_mode']})")


if __name__ == "__main__":
    main()
