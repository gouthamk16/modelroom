import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler, OneHotEncoder, StandardScaler


def _split_indices(n: int, train_ratio: float, val_ratio: float, seed: int):
    rng = np.random.default_rng(seed)
    idx = rng.permutation(n)
    n_train = int(n * train_ratio)
    n_val = int(n * val_ratio)
    return idx[:n_train], idx[n_train : n_train + n_val], idx[n_train + n_val :]


def _is_classification(y: pd.Series) -> bool:
    if not pd.api.types.is_numeric_dtype(y):
        return True
    return y.nunique(dropna=True) <= max(2, int(0.05 * len(y)))


def prepare(df: pd.DataFrame, spec: dict) -> dict:
    df = df.copy()
    steps = spec.get("steps", [])
    types = [s["type"] for s in steps]
    target = spec["target"]

    if "drop_nulls" in types:
        df = df.dropna().reset_index(drop=True)

    y_raw = df[target]
    X = df.drop(columns=[target])
    num_cols = [c for c in X.columns if pd.api.types.is_numeric_dtype(X[c])]
    cat_cols = [c for c in X.columns if c not in num_cols]

    if "impute" in types:
        for c in num_cols:
            X[c] = X[c].fillna(X[c].mean())
        for c in cat_cols:
            mode = X[c].mode(dropna=True)
            X[c] = X[c].fillna(mode.iloc[0] if len(mode) else "missing")

    tr, va, te = _split_indices(
        len(df),
        spec.get("train_ratio", 0.7),
        spec.get("val_ratio", 0.15),
        spec.get("seed", 42),
    )

    scaler = None
    if "standardize" in types:
        scaler = StandardScaler()
    elif "minmax" in types:
        scaler = MinMaxScaler()

    feature_names: list[str] = list(num_cols)
    if scaler is not None and num_cols:
        scaler.fit(X[num_cols].to_numpy(dtype=np.float64)[tr])

    def _num_block(rows):
        if not num_cols:
            return np.empty((len(rows), 0))
        block = X[num_cols].to_numpy(dtype=np.float64)[rows]
        return scaler.transform(block) if scaler is not None else block

    encoder = None
    if "one_hot" in types and cat_cols:
        encoder = OneHotEncoder(handle_unknown="ignore", sparse_output=False)
        encoder.fit(X[cat_cols].iloc[tr])
        feature_names = feature_names + list(encoder.get_feature_names_out(cat_cols))

    def _cat_block(rows):
        if encoder is None or not cat_cols:
            return np.empty((len(rows), 0))
        return encoder.transform(X[cat_cols].iloc[rows])

    def _features(rows):
        return np.hstack([_num_block(rows), _cat_block(rows)]).astype(np.float32)

    task = "classification" if _is_classification(y_raw) else "regression"
    if task == "classification":
        classes = sorted(map(str, pd.unique(y_raw.astype(str))))
        class_to_idx = {c: i for i, c in enumerate(classes)}
        y_all = y_raw.astype(str).map(class_to_idx).to_numpy()
        n_classes = len(classes)
    else:
        classes = []
        y_all = y_raw.to_numpy(dtype=np.float32)
        n_classes = 0

    return {
        "task": task,
        "classes": classes,
        "n_classes": n_classes,
        "feature_names": feature_names,
        "n_features": len(feature_names),
        "X_train": _features(tr), "y_train": y_all[tr],
        "X_val": _features(va), "y_val": y_all[va],
        "X_test": _features(te), "y_test": y_all[te],
    }


def summarize(out: dict) -> dict:
    summary = {
        "task": out["task"],
        "n_features": out["n_features"],
        "n_classes": out["n_classes"],
        "classes": out["classes"],
        "splits": {
            "train": int(out["X_train"].shape[0]),
            "val": int(out["X_val"].shape[0]),
            "test": int(out["X_test"].shape[0]),
        },
    }
    if out["task"] == "classification":
        idx, counts = np.unique(out["y_train"], return_counts=True)
        summary["target_distribution"] = {
            out["classes"][int(i)]: int(c) for i, c in zip(idx, counts)
        }
    return summary
