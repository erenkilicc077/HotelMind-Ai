# HotelMind AI roadmap

## Implemented in v0.2

- Real historical Hotel Booking Demand CSV and checksum-verified retrieval.
- Four models, arrival-date group split and validation AP selection.
- Separate test metrics, ROC/calibration curves and confusion matrix.
- Turkish dashboard connected to FastAPI; matching browser model inference.
- Individual SHAP explanations, batch CSV analysis, downloads and local history.
- Python 3.12 Windows launcher and automated contract/parity tests.

## Next research iteration

1. Agree a hotel intervention objective and relative false-positive/false-negative costs.
2. Predefine and compare calibration/threshold policies using training and validation only.
3. Add multiple temporal folds; retain a new untouched future period for a later final claim.
4. Audit creation-time snapshots and cancellation-label availability using a real event log.
5. Validate on authorized local hotel data and check hotel/season-specific drift.

## Later application work

- Anonymized PMS import, durable reservation storage and user roles.
- Intervention outcomes and monitoring; only then an optional agent interface.
- Demand forecasts or pricing modules as separate evaluated tasks.

No PMS writes, production validation, agent reservation flow or current-hotel accuracy claim is included in v0.2.
