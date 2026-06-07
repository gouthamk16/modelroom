import io


def _upload(client):
    csv = b"age,city\n20,NY\n30,LA\n40,NY\n"
    return client.post(
        "/api/datasets",
        files={"file": ("churn.csv", io.BytesIO(csv), "text/csv")},
    )


def test_upload_then_fetch_metadata_and_views(client, monkeypatch, tmp_path):
    monkeypatch.setenv("MODELROOM_WORKSPACE", str(tmp_path))

    res = _upload(client)
    assert res.status_code == 201
    ds = res.json()
    assert ds["n_rows"] == 3
    assert ds["n_cols"] == 2
    assert "project_id" not in ds

    did = ds["id"]
    assert [d["id"] for d in client.get("/api/datasets").json()] == [did]

    schema = client.get(f"/api/datasets/{did}/schema").json()
    assert {c["name"] for c in schema} == {"age", "city"}

    preview = client.get(f"/api/datasets/{did}/preview").json()
    assert preview["rows"][0]["city"] == "NY"

    hist = client.get(f"/api/datasets/{did}/histogram", params={"column": "city"}).json()
    assert hist["kind"] == "categorical"


def test_missing_dataset_404(client):
    assert client.get("/api/datasets/999/schema").status_code == 404


def test_load_sample(client, monkeypatch, tmp_path):
    monkeypatch.setenv("MODELROOM_WORKSPACE", str(tmp_path))
    import pandas as pd

    from app.datasets import samples

    monkeypatch.setitem(
        samples.SAMPLES["mnist"],
        "loader",
        lambda: pd.DataFrame({"px0": [1, 2, 3], "px1": [4, 5, 6], "label": [0, 1, 0]}),
    )
    res = client.post("/api/datasets/samples/mnist")
    assert res.status_code == 201
    assert res.json()["n_cols"] == 3
    assert res.json()["n_rows"] == 3
    assert client.post("/api/datasets/samples/nope").status_code == 404
