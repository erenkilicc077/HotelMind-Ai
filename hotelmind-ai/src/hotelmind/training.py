"""Validation-based model selection and one untouched time holdout."""
import hashlib
import json
import platform
import time
import warnings
from datetime import datetime, timezone
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.calibration import calibration_curve
from sklearn.metrics import (accuracy_score, average_precision_score, brier_score_loss,
    confusion_matrix, f1_score, precision_score, recall_score, roc_auc_score, roc_curve)
from threadpoolctl import threadpool_limits
from .config import CANCELLATION_DECISION_THRESHOLD, FEATURE_COLUMNS, MODEL_VERSION, TARGET
from .data import chronological_train_val_test_split, load_training_data
from .modeling import make_model

CANDIDATES = ("logistic_regression", "random_forest", "xgboost", "neural_network")


def compute_metrics(y_true, probabilities):
    predictions = probabilities >= CANCELLATION_DECISION_THRESHOLD
    return {key: round(float(value), 6) for key, value in {
        "roc_auc": roc_auc_score(y_true, probabilities),
        "pr_auc": average_precision_score(y_true, probabilities),
        "accuracy": accuracy_score(y_true, predictions),
        "precision_at_0_50": precision_score(y_true, predictions, zero_division=0),
        "recall_at_0_50": recall_score(y_true, predictions, zero_division=0),
        "f1_at_0_50": f1_score(y_true, predictions, zero_division=0),
        "brier_score": brier_score_loss(y_true, probabilities),
    }.items()}


def date_range(part):
    if "_arrival_date" not in part:
        return None
    return [str(part["_arrival_date"].min().date()), str(part["_arrival_date"].max().date())]


def train_and_evaluate(dataset_path, output_dir, candidates=CANDIDATES):
    data = load_training_data(dataset_path)
    train, val, test = chronological_train_val_test_split(data)
    for name, part in (("train", train), ("validation", val), ("test", test)):
        if part[TARGET].nunique() != 2:
            raise ValueError(f"{name} must contain both classes")
    results, timings, fit_warnings = {}, {}, {}
    with threadpool_limits(limits=2):
        for candidate in candidates:
            print(f"Training {candidate} on {len(train):,} rows…", flush=True)
            start = time.perf_counter()
            pipeline = make_model(candidate)
            with warnings.catch_warnings(record=True) as captured:
                warnings.simplefilter("always")
                pipeline.fit(train[FEATURE_COLUMNS], train[TARGET].astype(int))
            fit_warnings[candidate] = list(dict.fromkeys(str(w.message) for w in captured))
            results[candidate] = compute_metrics(val[TARGET], pipeline.predict_proba(val[FEATURE_COLUMNS])[:, 1])
            timings[candidate] = round(time.perf_counter() - start, 2)
            print(f"  validation AP={results[candidate]['pr_auc']:.4f}; AUC={results[candidate]['roc_auc']:.4f}", flush=True)
        best = max(candidates, key=lambda name: results[name]["pr_auc"])
        combined = pd.concat([train, val], ignore_index=True)
        model = make_model(best)
        model.fit(combined[FEATURE_COLUMNS], combined[TARGET].astype(int))
        model._hotelmind_baseline = model.named_steps["preprocessor"].transform(combined[FEATURE_COLUMNS].sample(min(512, len(combined)), random_state=42)).mean(axis=0)
        model._hotelmind_name = best
        probabilities = model.predict_proba(test[FEATURE_COLUMNS])[:, 1]
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, out / "cancellation_pipeline.joblib", compress=3)
    raw_rows = len(pd.read_csv(dataset_path, usecols=[TARGET]))
    report = {
        "model_version": MODEL_VERSION, "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "dataset": Path(dataset_path).name, "data_kind": "synthetic" if "demo_sequence" in data else "historical",
        "dataset_sha256": hashlib.sha256(Path(dataset_path).read_bytes()).hexdigest(),
        "raw_rows": raw_rows, "rows_after_filtering": len(data), "excluded_rows": raw_rows-len(data),
        "split_counts": {"train": len(train), "validation": len(val), "test": len(test)},
        "split_dates": {"train": date_range(train), "validation": date_range(val), "test": date_range(test)},
        "split_class_rates": {name: round(float(part[TARGET].mean()), 6) for name, part in [("train",train),("validation",val),("test",test)]},
        "validation_metrics": results, "training_seconds": timings, "training_warnings": fit_warnings,
        "selected_model": best, "holdout_test_metrics": compute_metrics(test[TARGET], probabilities),
        "selection_metric": "validation_average_precision", "decision_threshold": CANCELLATION_DECISION_THRESHOLD,
        "split_method": "chronological_arrival_date_groups_approx_70_15_15" if "_arrival_date" in data else "demo_sequence_70_15_15",
        "feature_columns": FEATURE_COLUMNS,
        "versions": {"python": platform.python_version(), "sklearn": sklearn.__version__, "numpy": np.__version__, "pandas": pd.__version__},
        "limitations": [
            "Retrospective arrival-date benchmark; not a point-in-time label-availability backtest.",
            "Snapshots do not guarantee every input was known at booking creation (including final ADR and deposit type).",
            "Historic Portuguese hotels (2015–2017) do not establish performance in Antalya or current hotels.",
            "Probabilities are uncalibrated; 0.30/0.50/0.65 thresholds are demonstration choices, not validated policies.",
            "No guest identifier is available to enforce guest-disjoint evaluation; repeated bookings may remain.",
            "SHAP explains associations learned by a model, not causal effects.",
        ],
    }
    y = test[TARGET].to_numpy()
    fpr, tpr, _ = roc_curve(y, probabilities)
    ix = np.unique(np.linspace(0, len(fpr)-1, min(120,len(fpr))).astype(int))
    observed, predicted = calibration_curve(y, probabilities, n_bins=10)
    report["holdout_curves"] = {
        "roc": [[float(fpr[i]),float(tpr[i])] for i in ix],
        "calibration": [[float(a),float(b)] for a,b in zip(predicted,observed)],
        "confusion_matrix": confusion_matrix(y, probabilities >= .5, labels=[0,1]).tolist(),
    }
    (out / "metrics.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    if "_arrival_date" in data:
        monthly = data.assign(month=data["_arrival_date"].dt.strftime("%Y-%m")).groupby("month")[TARGET].agg(["size","sum","mean"])
        summary = {
            "dataset_rows": len(data), "cancellation_rate": float(data[TARGET].mean()),
            "average_adr": float(data["adr"].mean()), "average_lead_time": float(data["lead_time"].mean()),
            "monthly": [{"month": month, "bookings": int(r["size"]), "cancellations": int(r["sum"]), "rate": float(r["mean"])} for month,r in monthly.iterrows()],
            "hotels": [{"hotel": hotel, "bookings": len(part), "cancellation_rate": float(part[TARGET].mean())} for hotel,part in data.groupby("hotel")],
        }
        (out / "dataset_summary.json").write_text(json.dumps(summary, ensure_ascii=False), encoding="utf-8")
    return report
