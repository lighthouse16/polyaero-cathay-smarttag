import json
import time
from datetime import datetime, UTC
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import (
    ExtraTreesClassifier,
    HistGradientBoostingClassifier,
    HistGradientBoostingRegressor,
    RandomForestClassifier,
)
from sklearn.inspection import permutation_importance
from sklearn.metrics import (
    brier_score_loss,
    log_loss,
    mean_absolute_error,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_PATH = BASE_DIR / "data" / "hkg_hub_feeder_dataset_250k.csv"
ARTIFACT_PATH = BASE_DIR / "artifacts" / "cathay_bag_risk_bundle.joblib"
REPORT_PATH = BASE_DIR / "artifacts" / "training_audit_report.json"

FEATURE_COLS = [
    "inbound_delay_mins",
    "scheduled_transfer_mins",
    "weather_impact_score",
    "airport_congestion_index",
    "dest_flight_frequency_pct",
    "historical_route_delay_rate",
]


def build_large_hkg_dataset(n: int = 250_000, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)

    scheduled_transfer = rng.integers(35, 220, size=n)
    historical_delay_rate = rng.uniform(0.06, 0.58, size=n)
    weather_score = rng.choice([1, 2, 3, 4, 5], p=[0.40, 0.27, 0.17, 0.10, 0.06], size=n)
    congestion_idx = rng.choice([1, 2, 3, 4, 5], p=[0.18, 0.31, 0.26, 0.16, 0.09], size=n)
    dest_freq_pct = rng.choice([12.0, 20.0, 35.0, 60.0, 85.0], p=[0.25, 0.25, 0.20, 0.15, 0.15], size=n)

    # Non-linear interaction between weather, hub congestion, and route delay history
    base_delay = (
        (weather_score - 1) * 11.2
        + (congestion_idx - 1) * 4.2
        + (weather_score >= 4) * (congestion_idx >= 4) * 9.5
        + historical_delay_rate * 29.0
        + rng.normal(-3.5, 11.5, size=n)
    )
    inbound_delay = np.clip(np.round(base_delay), -10, 140).astype(int)

    # HKG Minimum Connection Time (~48 mins) + non-linear apron/BHS friction
    effective_buffer = (
        scheduled_transfer
        - np.maximum(0, inbound_delay)
        - (congestion_idx - 1) * 3.8
        - (weather_score - 1) * 1.6
    )

    logit = (47.0 - effective_buffer) / 11.0 + (weather_score - 2.5) * 0.24
    true_miss_prob = 1.0 / (1.0 + np.exp(-logit))
    missed_connection = (rng.uniform(0, 1, size=n) < true_miss_prob).astype(int)

    bhs_transfer_mins = (
        23.5
        + (congestion_idx - 1) * 4.6
        + (weather_score - 1) * 3.1
        + (inbound_delay > 30) * 3.5
        + rng.normal(0, 3.8, size=n)
    )

    return pd.DataFrame({
        "inbound_delay_mins": inbound_delay,
        "scheduled_transfer_mins": scheduled_transfer,
        "weather_impact_score": weather_score.astype(float),
        "airport_congestion_index": congestion_idx.astype(float),
        "dest_flight_frequency_pct": dest_freq_pct,
        "historical_route_delay_rate": historical_delay_rate,
        "missed_connection": missed_connection,
        "bhs_transfer_mins": np.clip(bhs_transfer_mins, 14.0, 90.0),
    })


def log(msg: str) -> None:
    ts = datetime.now(UTC).strftime("%H:%M:%S UTC")
    print(f"[{ts}] {msg}", flush=True)


def main() -> None:
    t0 = time.time()
    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    ARTIFACT_PATH.parent.mkdir(parents=True, exist_ok=True)

    log("STEP 1/5 · Generating & saving 250,000-row HKG Hub Telemetry Dataset...")
    df = build_large_hkg_dataset(n=250_000, seed=42)
    df.to_csv(DATA_PATH, index=False)
    log(f"Dataset saved -> {DATA_PATH} ({len(df):,} rows | Positive miss rate: {df['missed_connection'].mean():.3f})")

    # Strict 70% Train / 15% Validation / 15% Holdout Test stratified split
    log("STEP 2/5 · Creating stratified 70% Train / 15% Validation / 15% Holdout Test splits...")
    X = df[FEATURE_COLS]
    y_cls = df["missed_connection"]
    y_reg = df["bhs_transfer_mins"]

    X_train, X_temp, y_cls_train, y_cls_temp, y_reg_train, y_reg_temp = train_test_split(
        X, y_cls, y_reg, test_size=0.30, stratify=y_cls, random_state=42
    )
    X_val, X_test, y_cls_val, y_cls_test, y_reg_val, y_reg_test = train_test_split(
        X_temp, y_cls_temp, y_reg_temp, test_size=0.50, stratify=y_cls_temp, random_state=42
    )
    log(
        f"Split sizes -> Train: {len(X_train):,} (70.0%) | "
        f"Validation: {len(X_val):,} (15.0%) | Holdout Test: {len(X_test):,} (15.0%)"
    )

    # Candidate model architectures + hyperparameter grid (5-fold CV on 70% Train)
    candidates = [
        ("HGB_depth4_lr0.03_iter400", lambda: HistGradientBoostingClassifier(max_depth=4, learning_rate=0.03, max_iter=400, min_samples_leaf=80, l2_regularization=1.0, random_state=42)),
        ("HGB_depth6_lr0.03_iter500", lambda: HistGradientBoostingClassifier(max_depth=6, learning_rate=0.03, max_iter=500, min_samples_leaf=60, l2_regularization=2.0, random_state=42)),
        ("HGB_depth8_lr0.02_iter700", lambda: HistGradientBoostingClassifier(max_depth=8, learning_rate=0.02, max_iter=700, min_samples_leaf=50, l2_regularization=5.0, random_state=42)),
        ("RandomForest_300trees_d14", lambda: RandomForestClassifier(n_estimators=300, max_depth=14, min_samples_leaf=25, n_jobs=-1, random_state=42)),
        ("ExtraTrees_350trees_d16",   lambda: ExtraTreesClassifier(n_estimators=350, max_depth=16, min_samples_leaf=20, n_jobs=-1, random_state=42)),
        ("NeuralNet_MLP_128x64x32",   lambda: make_pipeline(StandardScaler(), MLPClassifier(hidden_layer_sizes=(128, 64, 32), max_iter=45, early_stopping=True, validation_fraction=0.1, random_state=42))),
    ]

    log(f"STEP 3/5 · Running 5-Fold Cross-Validation across {len(candidates)} candidate architectures on 70% Train...")
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    leaderboard = []

    for idx, (name, builder) in enumerate(candidates, 1):
        cand_start = time.time()
        fold_aucs = []
        fold_briers = []
        for fold_num, (tr_idx, va_idx) in enumerate(skf.split(X_train, y_cls_train), 1):
            model = builder()
            model.fit(X_train.iloc[tr_idx], y_cls_train.iloc[tr_idx])
            probs = model.predict_proba(X_train.iloc[va_idx])[:, 1]
            auc = roc_auc_score(y_cls_train.iloc[va_idx], probs)
            brier = brier_score_loss(y_cls_train.iloc[va_idx], probs)
            fold_aucs.append(auc)
            fold_briers.append(brier)
            log(f"  [{idx}/{len(candidates)}] {name} · Fold {fold_num}/5 -> CV ROC-AUC: {auc:.4f} | Brier: {brier:.4f}")

        # Evaluate on dedicated 15% Validation split
        val_model = builder()
        val_model.fit(X_train, y_cls_train)
        val_probs = val_model.predict_proba(X_val)[:, 1]
        val_auc = roc_auc_score(y_cls_val, val_probs)
        val_brier = brier_score_loss(y_cls_val, val_probs)
        val_logloss = log_loss(y_cls_val, val_probs)
        elapsed_cand = round((time.time() - cand_start) / 60.0, 2)

        leaderboard.append({
            "name": name,
            "cv_mean_auc": round(float(np.mean(fold_aucs)), 5),
            "cv_std_auc": round(float(np.std(fold_aucs)), 5),
            "val_auc": round(float(val_auc), 5),
            "val_brier": round(float(val_brier), 5),
            "val_logloss": round(float(val_logloss), 5),
            "duration_mins": elapsed_cand,
            "builder": builder,
        })
        log(f"Completed {name} in {elapsed_cand:.2f} mins | 15% Val ROC-AUC: {val_auc:.5f} | Val LogLoss: {val_logloss:.5f}")

    leaderboard.sort(key=lambda r: (r["val_auc"], -r["val_brier"]), reverse=True)
    winner = leaderboard[0]
    log(f"STEP 4/5 · Winner selected on 15% Validation set: {winner['name']} (Val AUC: {winner['val_auc']:.5f})")

    # Fit winning classifier on 70% Train and calibrate probabilities using 15% Validation set
    raw_best_clf = winner["builder"]()
    raw_best_clf.fit(X_train, y_cls_train)
    try:
        from sklearn.frozen import FrozenEstimator
        calibrated_clf = CalibratedClassifierCV(FrozenEstimator(raw_best_clf), method="isotonic")
    except ImportError:
        calibrated_clf = CalibratedClassifierCV(raw_best_clf, method="isotonic", cv="prefit")
    calibrated_clf.fit(X_val, y_cls_val)

    # Train BHS Transfer Time Regressor on 70% Train + evaluate on 15% Validation
    bhs_reg = HistGradientBoostingRegressor(max_depth=6, learning_rate=0.03, max_iter=500, random_state=42)
    bhs_reg.fit(X_train, y_reg_train)
    val_mae = mean_absolute_error(y_reg_val, bhs_reg.predict(X_val))

    # Final unbiased evaluation on untouched 15% Holdout Test set
    log("STEP 5/5 · Evaluating calibrated champion model on untouched 15% Holdout Test set...")
    test_probs = calibrated_clf.predict_proba(X_test)[:, 1]
    test_auc = roc_auc_score(y_cls_test, test_probs)
    test_brier = brier_score_loss(y_cls_test, test_probs)
    test_logloss = log_loss(y_cls_test, test_probs)
    test_mae = mean_absolute_error(y_reg_test, bhs_reg.predict(X_test))

    perm = permutation_importance(calibrated_clf, X_test.iloc[:15000], y_cls_test.iloc[:15000], n_repeats=10, random_state=42, n_jobs=-1)
    feat_importance = {
        col: round(float(imp), 5)
        for col, imp in sorted(zip(FEATURE_COLS, perm.importances_mean), key=lambda x: x[1], reverse=True)
    }

    total_mins = round((time.time() - t0) / 60.0, 2)
    joblib.dump(
        {
            "classifier": calibrated_clf,
            "regressor": bhs_reg,
            "features": FEATURE_COLS,
            "schema": "hkg-hub-feeder-v3-deep-70-15-15",
            "metrics": {
                "test_roc_auc": round(float(test_auc), 5),
                "test_brier_score": round(float(test_brier), 5),
                "test_log_loss": round(float(test_logloss), 5),
                "test_bhs_mae_mins": round(float(test_mae), 2),
                "feature_importance": feat_importance,
            },
        },
        ARTIFACT_PATH,
    )

    audit_report = {
        "completed_at_utc": datetime.now(UTC).isoformat(),
        "total_training_duration_mins": total_mins,
        "dataset_rows": len(df),
        "split_strategy": {"train": "70%", "validation": "15%", "holdout_test": "15%"},
        "winning_architecture": winner["name"],
        "holdout_test_metrics": {
            "roc_auc": round(float(test_auc), 5),
            "brier_calibration_score": round(float(test_brier), 5),
            "log_loss": round(float(test_logloss), 5),
            "bhs_transfer_mae_mins": round(float(test_mae), 2),
        },
        "permutation_feature_importance": feat_importance,
        "validation_leaderboard": [{k: v for k, v in row.items() if k != "builder"} for row in leaderboard],
    }
    REPORT_PATH.write_text(json.dumps(audit_report, indent=2))

    log("=================================================================")
    log(f"TRAINING COMPLETE in {total_mins:.2f} mins")
    log(f"Holdout 15% Test ROC-AUC: {test_auc:.5f} | Brier Score: {test_brier:.5f} | BHS MAE: {test_mae:.2f} mins")
    log(f"Feature Importance: {feat_importance}")
    log(f"Saved model bundle -> {ARTIFACT_PATH}")
    log(f"Saved audit report -> {REPORT_PATH}")
    log("=================================================================")


if __name__ == "__main__":
    main()
