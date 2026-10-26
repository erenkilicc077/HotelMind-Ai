"""End-to-end preprocessing and baseline classification models."""

from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from .config import CATEGORICAL_FEATURES, NUMERIC_FEATURES


def make_preprocessor() -> ColumnTransformer:
    numeric = Pipeline(
        [("imputer", SimpleImputer(strategy="median")), ("scaler", StandardScaler())]
    )
    categorical = Pipeline(
        [
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
        ]
    )
    return ColumnTransformer(
        [("numeric", numeric, NUMERIC_FEATURES), ("categorical", categorical, CATEGORICAL_FEATURES)]
    )


def make_model(name: str) -> Pipeline:
    if name == "logistic_regression":
        estimator = LogisticRegression(max_iter=1500, random_state=42)
    elif name == "random_forest":
        estimator = RandomForestClassifier(
            n_estimators=160, max_depth=14, min_samples_leaf=6, random_state=42, n_jobs=2
        )
    elif name == "xgboost":
        from xgboost import XGBClassifier
        estimator = XGBClassifier(
            n_estimators=240, max_depth=5, learning_rate=0.055,
            min_child_weight=5, subsample=0.85, colsample_bytree=0.9,
            reg_lambda=2, objective="binary:logistic", eval_metric="logloss",
            tree_method="hist", n_jobs=2, random_state=42,
        )
    elif name == "neural_network":
        estimator = MLPClassifier(
            hidden_layer_sizes=(64, 32), activation="relu", batch_size=512,
            max_iter=100, early_stopping=True, validation_fraction=0.1,
            n_iter_no_change=8, alpha=0.01, random_state=42,
        )
    else:
        raise ValueError(f"Unknown model: {name}")
    return Pipeline([("preprocessor", make_preprocessor()), ("classifier", estimator)])
