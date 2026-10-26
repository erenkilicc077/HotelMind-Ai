import json

from fastapi.testclient import TestClient

from hotelmind.api import app, load_model
from hotelmind.demo import generate_demo_data
from hotelmind.training import CANDIDATES, train_and_evaluate


EXAMPLE_BOOKING = {
    "hotel": "City Hotel",
    "arrival_date_month": "July",
    "meal": "BB",
    "market_segment": "Online TA",
    "distribution_channel": "TA/TO",
    "reserved_room_type": "A",
    "deposit_type": "No Deposit",
    "customer_type": "Transient",
    "lead_time": 130,
    "stays_in_weekend_nights": 2,
    "stays_in_week_nights": 3,
    "adults": 2,
    "children": 0,
    "babies": 0,
    "previous_cancellations": 0,
    "previous_bookings_not_canceled": 0,
    "adr": 115.5,
}


def test_training_and_live_prediction(tmp_path, monkeypatch):
    csv_file = tmp_path / "demo.csv"
    outputs = tmp_path / "trained_models"
    generate_demo_data(csv_file, rows=500)
    report = train_and_evaluate(csv_file, outputs)
    assert report["selected_model"] in CANDIDATES
    assert 0 <= report["holdout_test_metrics"]["roc_auc"] <= 1
    assert json.loads((outputs / "metrics.json").read_text()) == report

    monkeypatch.setenv("HOTELMIND_MODEL_PATH", str(outputs / "cancellation_pipeline.joblib"))
    load_model.cache_clear()
    with TestClient(app) as client:
        assert client.get("/health").json()["model_available"] is True
        prediction = client.post("/predict", json=EXAMPLE_BOOKING)
        assert prediction.status_code == 200, prediction.text
        result = prediction.json()
        assert 0 <= result["cancellation_probability"] <= 1
        assert result["risk_level"] in ("Low", "Medium", "High")
        batch = client.post('/predict/batch', json={'bookings':[EXAMPLE_BOOKING,EXAMPLE_BOOKING]})
        assert batch.status_code == 200
        assert batch.json()['predictions'][0]['cancellation_probability'] == result['cancellation_probability']
        assert client.post('/predict/batch',json={'bookings':[]}).status_code == 422


def test_missing_artifact_returns_503(tmp_path, monkeypatch):
    monkeypatch.setenv("HOTELMIND_MODEL_PATH", str(tmp_path / "missing.joblib"))
    with TestClient(app) as client:
        assert client.get("/health").json()["model_available"] is False
        assert client.post("/predict", json=EXAMPLE_BOOKING).status_code == 503


def test_invalid_booking_is_rejected(tmp_path, monkeypatch):
    monkeypatch.setenv("HOTELMIND_MODEL_PATH", str(tmp_path / "missing.joblib"))
    with TestClient(app) as client:
        booking = {**EXAMPLE_BOOKING, "lead_time": -10}
        response = client.post("/predict", json=booking)
        assert response.status_code == 422
