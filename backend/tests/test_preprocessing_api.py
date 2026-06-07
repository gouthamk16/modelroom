import io


def _make_dataset(client, monkeypatch, tmp_path):
    monkeypatch.setenv("MODELROOM_WORKSPACE", str(tmp_path))
    pid = client.post("/api/projects", json={"name": "P"}).json()["id"]
    rows = "age,city,label\n" + "\n".join(
        f"{20 + i},{'NY' if i % 2 else 'LA'},{'yes' if i % 3 else 'no'}" for i in range(20)
    )
    res = client.post(
        f"/api/projects/{pid}/datasets",
        files={"file": ("d.csv", io.BytesIO(rows.encode()), "text/csv")},
    )
    return res.json()["id"]


def test_save_and_apply_pipeline(client, monkeypatch, tmp_path):
    did = _make_dataset(client, monkeypatch, tmp_path)

    spec = {
        "target": "label",
        "steps": [{"type": "standardize", "params": {}}, {"type": "one_hot", "params": {}}],
        "train_ratio": 0.7,
        "val_ratio": 0.15,
        "seed": 42,
    }
    save = client.put(f"/api/datasets/{did}/pipeline", json=spec)
    assert save.status_code == 200

    applied = client.post(f"/api/datasets/{did}/pipeline/apply").json()
    assert applied["task"] == "classification"
    assert applied["splits"]["train"] + applied["splits"]["val"] + applied["splits"]["test"] == 20
    assert "target_distribution" in applied

    got = client.get(f"/api/datasets/{did}/pipeline").json()
    assert got["target"] == "label"
