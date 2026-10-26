"""Minimal data validation and chronological splitting."""
import calendar
from pathlib import Path

import pandas as pd

from .config import CATEGORICAL_FEATURES, FEATURE_COLUMNS, NUMERIC_FEATURES, TARGET

MONTH_LOOKUP = {month: index for index, month in enumerate(calendar.month_name) if month}


def load_training_data(path: str | Path) -> pd.DataFrame:
    """Read a Hotel Booking Demand-compatible CSV and enforce core constraints."""
    path = Path(path)
    if not path.is_file():
        raise FileNotFoundError(f"Dataset not found: {path}")

    data = pd.read_csv(path, low_memory=False)
    required = set(FEATURE_COLUMNS + [TARGET])
    missing = sorted(required - set(data.columns))
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    data = data.copy()
    data.attrs["raw_rows"] = len(data)
    for column in NUMERIC_FEATURES:
        data[column] = pd.to_numeric(data[column], errors="coerce")
    for column in CATEGORICAL_FEATURES:
        # Impute missing categories inside each training fold, not across the dataset.
        data[column] = data[column].where(data[column].notna(), float("nan"))

    data[TARGET] = pd.to_numeric(data[TARGET], errors="coerce")
    data = data.loc[data[TARGET].isin([0, 1])].copy()
    data = data.loc[data["adr"].isna() | (data["adr"] >= 0)].copy()
    guest_count = data[["adults", "children", "babies"]].fillna(0).sum(axis=1)
    nights = data[["stays_in_weekend_nights", "stays_in_week_nights"]].fillna(0).sum(axis=1)
    data = data.loc[(guest_count >= 1) & (nights >= 1)].copy()
    counts = [c for c in NUMERIC_FEATURES if c != "adr"]
    data = data.loc[(data[counts].fillna(0) >= 0).all(axis=1)].copy()

    if len(data) < 100:
        raise ValueError("At least 100 valid rows are required for the starter training pipeline")
    if data[TARGET].nunique() != 2:
        raise ValueError("Both target classes (0 and 1) must occur in the dataset")

    # Arrival-date chronological ordering is a proxy for production backtesting.
    # Cancellation outcome availability cannot be fully reconstructed from this dataset.
    date_fields = {"arrival_date_year", "arrival_date_month", "arrival_date_day_of_month"}
    if date_fields.issubset(data.columns):
        month_num = data["arrival_date_month"].map(MONTH_LOOKUP)
        arrival_date = pd.to_datetime(
            {
                "year": pd.to_numeric(data["arrival_date_year"], errors="coerce"),
                "month": month_num,
                "day": pd.to_numeric(data["arrival_date_day_of_month"], errors="coerce"),
            },
            errors="coerce",
        )
        data = data.assign(_arrival_date=arrival_date)
        data = data.dropna(subset=["_arrival_date"])
        data = data.sort_values("_arrival_date", kind="stable")
    else:
        # For synthetic data, a sequence number allows the same split semantics.
        if "demo_sequence" in data.columns:
            data = data.sort_values("demo_sequence", kind="stable")
        else:
            raise ValueError(
                "Dataset must have arrival_date_year/month/day for chronological splitting; "
                "the synthetic demo may use demo_sequence instead."
            )
    return data.reset_index(drop=True)


def chronological_train_val_test_split(data: pd.DataFrame):
    """Approximate 70/15/15; never cut an arrival date across partitions."""
    n = len(data)
    train_end = int(n * 0.70)
    val_end = int(n * 0.85)
    if "_arrival_date" in data.columns:
        train_cutoff = data.iloc[train_end]["_arrival_date"]
        val_cutoff = data.iloc[val_end]["_arrival_date"]
        return (
            data.loc[data["_arrival_date"] < train_cutoff],
            data.loc[(data["_arrival_date"] >= train_cutoff) & (data["_arrival_date"] < val_cutoff)],
            data.loc[data["_arrival_date"] >= val_cutoff],
        )
    return data.iloc[:train_end], data.iloc[train_end:val_end], data.iloc[val_end:]
