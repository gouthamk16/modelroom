import pandas as pd

from app.datasets import analysis


def _df():
    return pd.DataFrame(
        {
            "age": [20, 30, 40, None],
            "city": ["NY", "LA", "NY", "SF"],
        }
    )


def test_infer_schema():
    schema = analysis.infer_schema(_df())
    by_name = {c["name"]: c for c in schema}
    assert by_name["age"]["kind"] == "numeric"
    assert by_name["age"]["n_null"] == 1
    assert by_name["city"]["kind"] == "categorical"
    assert by_name["city"]["n_unique"] == 3


def test_preview_replaces_nan_with_none():
    out = analysis.preview(_df(), n=10)
    assert out["columns"] == ["age", "city"]
    assert out["rows"][3]["age"] is None


def test_column_stats_numeric_and_categorical():
    stats = {s["name"]: s for s in analysis.column_stats(_df())}
    assert stats["age"]["min"] == 20.0
    assert stats["age"]["max"] == 40.0
    assert stats["city"]["top"][0]["value"] == "NY"
    assert stats["city"]["top"][0]["count"] == 2


def test_histogram_numeric_and_categorical():
    num = analysis.histogram(_df(), "age", bins=2)
    assert num["kind"] == "numeric"
    assert sum(b["count"] for b in num["bins"]) == 3  # NaN dropped

    cat = analysis.histogram(_df(), "city")
    assert cat["kind"] == "categorical"
    assert {b["value"] for b in cat["bars"]} == {"NY", "LA", "SF"}


def test_correlation_only_numeric():
    df = pd.DataFrame({"a": [1, 2, 3], "b": [2, 4, 6], "c": ["x", "y", "z"]})
    corr = analysis.correlation(df)
    assert corr["columns"] == ["a", "b"]
    assert corr["matrix"][0][1] == 1.0
