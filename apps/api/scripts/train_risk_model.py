import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor
from sklearn.calibration import CalibratedClassifierCV
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, mean_absolute_error

BASE_DIR = Path(__file__).resolve().parent.parent
SUBSET_CSV = BASE_DIR / "data" / "flight_risk_subset.csv"
ARTIFACT_PATH = BASE_DIR / "artifacts" / "cathay_bag_risk_bundle.joblib"


def main():
    raw = pd.read_csv(SUBSET_CSV)
    rng = np.random.default_rng(42)
    n = len(raw)

    # Map real BTS weather_delay & taxi_in into smooth 1..5 operational indices
    # Ensure balanced coverage across 1..5 so the model learns smooth gradients
    weather_from_bts = np.where(
        raw["weather_delay"] <= 0,
        rng.choice([1, 2], p=[0.65, 0.35], size=n),
        np.clip(np.ceil(raw["weather_delay"] / 20.0) + 2, 2, 5),
    )

    hub_counts = raw["origin"].value_counts()
    hub_pct = raw["origin"].map(hub_counts) / hub_counts.max()
    congestion = np.clip(np.round(1 + hub_pct * 2.2 + (raw["taxi_in"] / 14.0) * 1.8), 1, 5)

    transfer_mins = rng.integers(30, 180, size=n)
    load_factor = rng.uniform(60.0, 99.0, size=n)

    df = pd.DataFrame({
        "transfer_minutes": transfer_mins,
        "weather_severity": weather_from_bts.astype(float),
        "load_factor_pct": load_factor,
        "airport_congestion": congestion.astype(float),
        "scheduled_flight_mins": raw["crs_elapsed_time"].fillna(240),
    })

    # Real BTS arrival delay + operational penalty for severe weather/congestion/high load
    extra_ops_delay = (
        (df["weather_severity"] - 1) * 7.5
        + (df["airport_congestion"] - 1) * 4.5
        + np.maximum(0, df["load_factor_pct"] - 85.0) * 0.6
    )
    total_delay = raw["arr_delay"].clip(lower=-15) + extra_ops_delay
    effective_buffer = df["transfer_minutes"] - total_delay

    # Probabilistic risk label (smooth transition around 40-min hub MCT)
    logit = (42.0 - effective_buffer) / 14.0
    prob_true = 1.0 / (1.0 + np.exp(-logit))
    df["is_mishandled_risk"] = (rng.uniform(0, 1, size=n) < prob_true).astype(int)
    df["total_bag_transit_mins"] = raw["actual_elapsed_time"] + raw["taxi_in"] + 22.0 + np.maximum(0, extra_ops_delay * 0.4)

    feature_cols = [
        "transfer_minutes",
        "weather_severity",
        "load_factor_pct",
        "airport_congestion",
        "scheduled_flight_mins",
    ]
    X = df[feature_cols]

    X_train, X_test, y_cls_train, y_cls_test = train_test_split(
        X, df["is_mishandled_risk"], test_size=0.2, random_state=42
    )
    base_clf = HistGradientBoostingClassifier(max_depth=5, learning_rate=0.05, min_samples_leaf=80, random_state=42)
    clf = CalibratedClassifierCV(base_clf, method="sigmoid", cv=3)
    clf.fit(X_train, y_cls_train)
    auc = roc_auc_score(y_cls_test, clf.predict_proba(X_test)[:, 1])

    _, _, y_reg_train, y_reg_test = train_test_split(
        X, df["total_bag_transit_mins"], test_size=0.2, random_state=42
    )
    reg = HistGradientBoostingRegressor(max_depth=5, learning_rate=0.05, random_state=42)
    reg.fit(X_train, y_reg_train)
    mae = mean_absolute_error(y_reg_test, reg.predict(X_test))

    ARTIFACT_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"classifier": clf, "regressor": reg, "features": feature_cols}, ARTIFACT_PATH)
    print(f"Saved calibrated model -> {ARTIFACT_PATH} | ROC-AUC: {auc:.3f} | Arrival ETA MAE: {mae:.1f} mins")

    # Sanity check across 3 realistic scenarios
    samples = pd.DataFrame([
        {"transfer_minutes": 120, "weather_severity": 1, "load_factor_pct": 75.0, "airport_congestion": 1, "scheduled_flight_mins": 250.0},
        {"transfer_minutes": 65,  "weather_severity": 3, "load_factor_pct": 86.0, "airport_congestion": 3, "scheduled_flight_mins": 250.0},
        {"transfer_minutes": 35,  "weather_severity": 5, "load_factor_pct": 96.0, "airport_congestion": 5, "scheduled_flight_mins": 250.0},
    ])[feature_cols]
    scores = [int(round(p * 100)) for p in clf.predict_proba(samples)[:, 1]]
    print(f"Scenario scores (Low / Medium / High): {scores}")


if __name__ == "__main__":
    main()
