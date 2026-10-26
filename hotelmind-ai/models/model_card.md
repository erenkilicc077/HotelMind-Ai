# Model card — release 0.2.0

**Task:** Binary cancellation classification from 17 booking fields. **Selected estimator:** scikit-learn RandomForestClassifier, 160 trees, max depth 14, minimum leaf size 6; seed 42. Model selection: maximum validation average precision among Logistic Regression, Random Forest, XGBoost and MLP.

**Data:** 118,564 filtered historical bookings from two Portuguese hotels (2015–2017), out of 119,390 source rows. See `data/README.md` for source and checksum. The last 17,869 rows, grouped by complete arrival date, are the test period (2017-05-22–2017-08-31). Final model fitted on 100,695 training + validation rows.

**Test performance:** ROC-AUC 0.777688; AP 0.728006; accuracy 0.697577; precision@0.5 0.869933; recall@0.5 0.276433; F1@0.5 0.419549; Brier 0.182260. Matrix [[10512,292],[5112,1953]], rows actual 0/1, columns predicted 0/1. `metrics.json` is the authoritative machine-readable report.

**Explanation:** TreeSHAP, tree-path-dependent background encoded by fitted node covers, probability output for the forest. Attributions of one-hot columns are summed by original field. Associations, not causation. Portable browser values are compared against Python in `scripts/verify_browser.py`.

**Use:** Education and exploratory decision support. No validated operational intervention policy. Do not present this as contemporary Antalya-hotel performance.

**Limitations:** Uncalibrated probabilities, fixed demonstration bands/class threshold, low recall at 0.5, extraction-time snapshots and uncertain label availability, no guest-disjoint evaluation, only two hotels and one final temporal holdout. See the README and thesis notes. No hyperparameter search or multiple-fold uncertainty estimates were performed.

**Reproduction:** Python 3.12; `requirements-tested.txt`, `runtime_versions.json`, seed 42, `scripts/train.py` and `scripts/export_dashboard.py`. Models are environment-sensitive; load only trusted locally generated joblib artifacts.
