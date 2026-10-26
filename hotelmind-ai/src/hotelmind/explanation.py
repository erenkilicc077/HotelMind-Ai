"""SHAP in native model output space; group one-hot values to input fields."""
from functools import lru_cache
import numpy as np
from .config import CATEGORICAL_FEATURES, FEATURE_LABELS, NUMERIC_FEATURES


def encoded_groups(pipeline):
    categories = pipeline.named_steps["preprocessor"].named_transformers_["categorical"].named_steps["onehot"].categories_
    return NUMERIC_FEATURES + [f for f, values in zip(CATEGORICAL_FEATURES, categories) for _ in values]


@lru_cache(maxsize=2)
def tree_explainer(pipeline):
    import shap
    return shap.TreeExplainer(pipeline.named_steps["classifier"], feature_perturbation="tree_path_dependent", model_output="raw")


def explain(pipeline, frame):
    classifier = pipeline.named_steps["classifier"]
    transformed = pipeline.named_steps["preprocessor"].transform(frame)
    name = type(classifier).__name__
    if name in ("RandomForestClassifier", "XGBClassifier"):
        explanation = tree_explainer(pipeline)(transformed, check_additivity=True)
        values, bases = np.asarray(explanation.values), np.asarray(explanation.base_values)
        if values.ndim == 3:
            values, bases = values[:, :, 1], bases[:, 1]
        unit = "log_odds" if name == "XGBClassifier" else "probability"
        method = "TreeSHAP · tree_path_dependent"
    elif name == "LogisticRegression":
        baseline = pipeline._hotelmind_baseline
        values = (transformed - baseline) * classifier.coef_[0]
        bases = np.repeat(float(classifier.intercept_[0] + baseline @ classifier.coef_[0]), len(frame))
        unit, method = "log_odds", "Linear SHAP · independent background"
    else:
        return None
    groups = np.array(encoded_groups(pipeline))
    grouped = {key: float(values[0, groups == key].sum()) for key in dict.fromkeys(groups)}
    return {
        "method": method, "unit": unit, "base_value": float(bases[0]),
        "sum_contributions": float(values[0].sum()),
        "features": [{"feature": k, "label": FEATURE_LABELS[k], "contribution": v}
            for k,v in sorted(grouped.items(), key=lambda x: abs(x[1]), reverse=True)],
    }
