from pathlib import Path

import pandas as pd

from app.config import get_settings


def dataset_path(dataset_id: int) -> Path:
    return get_settings().datasets_dir / f"{dataset_id}.csv"


def save_csv(dataset_id: int, content: bytes) -> None:
    path = dataset_path(dataset_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)


def load_df(dataset_id: int) -> pd.DataFrame:
    return pd.read_csv(dataset_path(dataset_id))
