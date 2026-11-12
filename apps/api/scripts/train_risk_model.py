import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, mean_absolute_error

BASE_DIR = Path(__file__).resolve().parent.parent
SUBSET_CSV = BASE_DIR / "data" / "flight_risk_subset.csv"
ARTIFACT_PATH = BASE_DIR / "artifacts" / "cathay_bag_risk_bundle.joblib"


def main():
    raw = pd.read_csv(SUBSET_CSV)
    rng = np.random.default_rng(42)

    # Compute hub traffic density (flight volume per origin airport)
    hub_counts = raw["origin"].value_counts()
    hub_pct = raw["origin"].map(hub_counts) / hub_counts.max()

    df = pd.DataFrame({
        "transfer_minutes": rng.integers(30, 180, size=len(raw)),
        "weather_severity": np.clip(np.ceil(raw["weather_delay"] / 15.0) + 1, 1, 5),
        "load_factor_pct": rng.uniform(68.0, 99.0, size=len(raw)),
        "airport_congestion": np.clip(np.ceil(hub_pct * 3.0 + raw["taxi_in"] / 10.0), 1, 5),
        "scheduled_flight_mins": raw["crs_elapsed_time"].fillna(240),
    })

    # Ground-truth mishandling risk: transfer buffer compressed below 35 mins or severe weather delay
    effective_buffer = df["transfer_minutes"] - raw["arr_delay"].clip(lower=-15)
    df["is_mishandled_risk"] = ((effective_buffer < 35) | (raw["weather_delay"] > 20)).astype(int)
    df["total_bag_transit_mins"] = raw["actual_elapsed_time"] + raw["taxi_in"] + 22.0

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
    clf = HistGradientBoostingClassifier(max_depth=6, learning_rate=0.06, random_state=42)
    clf.fit(X_train, y_cls_train)
    auc = roc_auc_score(y_cls_test, clf.predict_proba(X_test)[:, 1])

    _, _, y_reg_train, y_reg_test = train_test_split(
        X, df["total_bag_transit_mins"], test_size=0.2, random_state=42
    )
    reg = HistGradientBoostingRegressor(max_depth=6, learning_rate=0.06, random_state=42)
    reg.fit(X_train, y_reg_train)
    mae = mean_absolute_error(y_reg_test, reg.predict(X_test))

    ARTIFACT_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"classifier": clf, "regressor": reg, "features": feature_cols}, ARTIFACT_PATH)
    print(f"Trained & saved -> {ARTIFACT_PATH}")
    print(f"Validation ROC-AUC: {auc:.3f} | Arrival ETA MAE: {mae:.1f} mins")


if __name__ == "__main__":
    main()
