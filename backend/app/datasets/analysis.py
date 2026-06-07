import math

import numpy as np
import pandas as pd


def _num(x) -> float | None:
    if x is None:
        return None
    val = float(x)
    return None if math.isnan(val) else val


def infer_schema(df: pd.DataFrame) -> list[dict]:
    out = []
    for name in df.columns:
        s = df[name]
        kind = "numeric" if pd.api.types.is_numeric_dtype(s) else "categorical"
        out.append(
            {
                "name": str(name),
                "dtype": str(s.dtype),
                "kind": kind,
                "n_null": int(s.isna().sum()),
                "n_unique": int(s.nunique(dropna=True)),
            }
        )
    return out


def preview(df: pd.DataFrame, n: int = 10) -> dict:
    head = df.head(n)
    safe = head.astype(object).where(pd.notnull(head), None)
    return {
        "columns": [str(c) for c in df.columns],
        "rows": safe.to_dict("records"),
    }


def column_stats(df: pd.DataFrame) -> list[dict]:
    out = []
    for name in df.columns:
        s = df[name]
        n_null = int(s.isna().sum())
        if pd.api.types.is_numeric_dtype(s):
            out.append(
                {
                    "name": str(name),
                    "kind": "numeric",
                    "min": _num(s.min()),
                    "max": _num(s.max()),
                    "mean": _num(s.mean()),
                    "std": _num(s.std()),
                    "n_null": n_null,
                }
            )
        else:
            vc = s.value_counts().head(5)
            out.append(
                {
                    "name": str(name),
                    "kind": "categorical",
                    "top": [{"value": str(k), "count": int(v)} for k, v in vc.items()],
                    "n_null": n_null,
                }
            )
    return out


def histogram(df: pd.DataFrame, column: str, bins: int = 10) -> dict:
    s = df[column].dropna()
    if pd.api.types.is_numeric_dtype(s):
        counts, edges = np.histogram(s, bins=bins)
        return {
            "kind": "numeric",
            "bins": [
                {
                    "start": float(edges[i]),
                    "end": float(edges[i + 1]),
                    "count": int(counts[i]),
                }
                for i in range(len(counts))
            ],
        }
    vc = s.value_counts().head(20)
    return {
        "kind": "categorical",
        "bars": [{"value": str(k), "count": int(v)} for k, v in vc.items()],
    }


def correlation(df: pd.DataFrame) -> dict:
    num = df.select_dtypes(include="number")
    corr = num.corr().fillna(0.0)
    return {
        "columns": [str(c) for c in corr.columns],
        "matrix": [[round(float(v), 3) for v in row] for row in corr.values],
    }
