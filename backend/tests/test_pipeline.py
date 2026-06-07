import numpy as np
import pandas as pd

from app.preprocessing import pipeline


def _df():
    # 20 rows so splits are non-empty
    rng = np.random.default_rng(0)
    return pd.DataFrame(
        {
            "age": rng.integers(18, 70, size=20).astype(float),
            "city": rng.choice(["NY", "LA", "SF"], size=20),
            "label": rng.choice(["yes", "no"], size=20),
        }
    )


def test_prepare_classification_shapes_and_summary():
    spec = {
        "target": "label",
        "steps": [{"type": "standardize", "params": {}}, {"type": "one_hot", "params": {}}],
        "train_ratio": 0.7,
        "val_ratio": 0.15,
        "seed": 42,
    }
    out = pipeline.prepare(_df(), spec)

    assert out["task"] == "classification"
    assert out["n_classes"] == 2
    assert set(out["classes"]) == {"no", "yes"}
    assert out["n_features"] == out["X_train"].shape[1]
    assert out["X_train"].dtype == np.float32
    assert (
        out["X_train"].shape[0] + out["X_val"].shape[0] + out["X_test"].shape[0] == 20
    )
    assert set(np.unique(out["y_train"])).issubset({0, 1})


def test_standardize_fits_on_train_only():
    spec = {
        "target": "label",
        "steps": [{"type": "standardize", "params": {}}],
        "train_ratio": 0.7,
        "val_ratio": 0.15,
        "seed": 1,
    }
    out = pipeline.prepare(_df(), spec)
    age_idx = out["feature_names"].index("age")
    assert abs(float(out["X_train"][:, age_idx].mean())) < 1e-6


def test_drop_nulls_reduces_rows():
    df = _df()
    df.loc[0, "age"] = np.nan
    spec = {
        "target": "label",
        "steps": [{"type": "drop_nulls", "params": {}}],
        "train_ratio": 0.7,
        "val_ratio": 0.15,
        "seed": 1,
    }
    out = pipeline.prepare(df, spec)
    total = out["X_train"].shape[0] + out["X_val"].shape[0] + out["X_test"].shape[0]
    assert total == 19


def test_regression_target():
    df = pd.DataFrame({"x": np.arange(20.0), "y": np.arange(20.0) * 2})
    spec = {"target": "y", "steps": [], "train_ratio": 0.7, "val_ratio": 0.15, "seed": 0}
    out = pipeline.prepare(df, spec)
    assert out["task"] == "regression"
    assert out["n_classes"] == 0
