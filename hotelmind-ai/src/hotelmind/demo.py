"""Reproducible artificial data for pipeline tests ONLY."""
import calendar
from pathlib import Path

import numpy as np
import pandas as pd


def generate_demo_data(path: str | Path, rows: int = 1800, seed: int = 42) -> pd.DataFrame:
    if rows < 100:
        raise ValueError("Generate at least 100 rows")
    rng = np.random.default_rng(seed)
    arrival_dates = pd.date_range("2024-01-01", "2025-12-31", periods=rows)
    hotel = rng.choice(["City Hotel", "Resort Hotel"], rows, p=[0.62, 0.38])
    lead_time = rng.integers(1, 330, rows)
    weekend = rng.integers(0, 4, rows)
    weekday = rng.integers(1, 9, rows)
    adults = rng.choice([1, 2, 3], rows, p=[0.18, 0.72, 0.10])
    children = rng.choice([0, 1, 2], rows, p=[0.77, 0.17, 0.06])
    previous_cancellations = rng.choice([0, 1, 2], rows, p=[0.88, 0.09, 0.03])
    deposit_type = rng.choice(["No Deposit", "Non Refund", "Refundable"], rows, p=[0.79, 0.18, 0.03])
    adr = np.maximum(20, rng.normal(120, 45, rows)).round(2)

    frame = pd.DataFrame(
        {
            "hotel": hotel,
            "arrival_date_year": arrival_dates.year,
            "arrival_date_month": [calendar.month_name[m] for m in arrival_dates.month],
            "arrival_date_day_of_month": arrival_dates.day,
            "lead_time": lead_time,
            "stays_in_weekend_nights": weekend,
            "stays_in_week_nights": weekday,
            "adults": adults,
            "children": children,
            "babies": rng.choice([0, 1], rows, p=[0.98, 0.02]),
            "meal": rng.choice(["BB", "HB", "SC"], rows, p=[0.7, 0.2, 0.1]),
            "market_segment": rng.choice(["Online TA", "Offline TA/TO", "Direct"], rows, p=[0.6, 0.25, 0.15]),
            "distribution_channel": rng.choice(["TA/TO", "Direct", "Corporate"], rows, p=[0.7, 0.25, 0.05]),
            "previous_cancellations": previous_cancellations,
            "previous_bookings_not_canceled": rng.integers(0, 5, rows),
            "reserved_room_type": rng.choice(["A", "D", "E"], rows, p=[0.64, 0.24, 0.12]),
            "deposit_type": deposit_type,
            "customer_type": rng.choice(["Transient", "Transient-Party", "Contract"], rows, p=[0.74, 0.21, 0.05]),
            "adr": adr,
            "demo_sequence": np.arange(rows),
        }
    )
    # These synthetic coefficients are deliberately invented, not learned from hotel data.
    logits = (
        -2.8 + 0.006 * lead_time + 2.2 * (deposit_type == "Non Refund")
        + 0.95 * (previous_cancellations > 0)
        + 0.35 * (hotel == "City Hotel")
        + 0.3 * (frame["market_segment"] == "Online TA")
        - 0.15 * (children > 0)
    )
    probability = 1 / (1 + np.exp(-logits))
    frame["is_canceled"] = rng.binomial(1, probability)
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(path, index=False)
    return frame
