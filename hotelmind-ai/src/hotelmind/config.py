"""Feature contract shared by training and online inference.

Feature selection reflects what can plausibly be available when a reservation
is created. It deliberately excludes reservation_status, assigned_room_type,
booking_changes and other post-booking information (label leakage).
"""
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
ARTIFACT_DIR = PROJECT_ROOT / "models"
MODEL_PATH = ARTIFACT_DIR / "cancellation_pipeline.joblib"
METRICS_PATH = ARTIFACT_DIR / "metrics.json"
TARGET = "is_canceled"

NUMERIC_FEATURES = [
    "lead_time",
    "stays_in_weekend_nights",
    "stays_in_week_nights",
    "adults",
    "children",
    "babies",
    "previous_cancellations",
    "previous_bookings_not_canceled",
    "adr",
]

CATEGORICAL_FEATURES = [
    "hotel",
    "arrival_date_month",
    "meal",
    "market_segment",
    "distribution_channel",
    "reserved_room_type",
    "deposit_type",
    "customer_type",
]

FEATURE_COLUMNS = NUMERIC_FEATURES + CATEGORICAL_FEATURES

# Prototype thresholds: NOT calibrated business interventions.
LOW_RISK_UPPER = 0.30
HIGH_RISK_LOWER = 0.65
CANCELLATION_DECISION_THRESHOLD = 0.50

MODEL_VERSION = "0.2.0"
CATEGORY_OPTIONS = {
    "hotel": ["Resort Hotel", "City Hotel"],
    "arrival_date_month": ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    "meal": ["BB", "HB", "FB", "SC", "Undefined"],
    "market_segment": ["Online TA", "Offline TA/TO", "Direct", "Groups", "Corporate", "Complementary", "Aviation", "Undefined"],
    "distribution_channel": ["TA/TO", "Direct", "Corporate", "GDS", "Undefined"],
    "reserved_room_type": list("ABCDEFGHLP"),
    "deposit_type": ["No Deposit", "Non Refund", "Refundable"],
    "customer_type": ["Transient", "Transient-Party", "Contract", "Group"],
}
FEATURE_LABELS = {
    "lead_time": "Rezervasyon ön süresi", "stays_in_weekend_nights": "Hafta sonu gecesi",
    "stays_in_week_nights": "Hafta içi gecesi", "adults": "Yetişkin sayısı",
    "children": "Çocuk sayısı", "babies": "Bebek sayısı", "previous_cancellations": "Geçmiş iptaller",
    "previous_bookings_not_canceled": "Tamamlanan rezervasyonlar", "adr": "Ortalama gecelik fiyat",
    "hotel": "Otel türü", "arrival_date_month": "Geliş ayı", "meal": "Pansiyon türü",
    "market_segment": "Pazar segmenti", "distribution_channel": "Dağıtım kanalı",
    "reserved_room_type": "Oda kategorisi", "deposit_type": "Depozito türü", "customer_type": "Müşteri türü",
}
