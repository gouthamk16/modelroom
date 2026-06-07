from pathlib import Path

import numpy as np

from app.config import get_settings

ARRAY_KEYS = ["X_train", "y_train", "X_val", "y_val", "X_test", "y_test"]


def prepared_path(preparation_id: int) -> Path:
    base = get_settings().workspace_dir / "prepared"
    base.mkdir(parents=True, exist_ok=True)
    return base / f"{preparation_id}.npz"


def save_prepared(preparation_id: int, arrays: dict) -> None:
    np.savez(
        prepared_path(preparation_id),
        **{k: v for k, v in arrays.items() if k in ARRAY_KEYS},
    )


def load_prepared(preparation_id: int) -> dict:
    with np.load(prepared_path(preparation_id), allow_pickle=False) as data:
        return {k: data[k] for k in data.files}
