import io
import time


def _prepared_model(client, monkeypatch, tmp_path):
    monkeypatch.setenv("MODELROOM_WORKSPACE", str(tmp_path))
    pid = client.post("/api/projects", json={"name": "P"}).json()["id"]
    rows = "a,b,label\n" + "\n".join(f"{i},{i * 2},{i % 2}" for i in range(40))
    did = client.post(
        "/api/datasets", files={"file": ("d.csv", io.BytesIO(rows.encode()), "text/csv")}
    ).json()["id"]
    client.put(
        f"/api/datasets/{did}/pipeline",
        json={
            "target": "label",
            "steps": [{"type": "standardize", "params": {}}],
            "train_ratio": 0.7,
            "val_ratio": 0.15,
            "seed": 1,
        },
    )
    client.post(f"/api/datasets/{did}/pipeline/apply")
    graph = {
        "nodes": [
            {"id": "in", "type": "input", "params": {"features": 2}},
            {"id": "out", "type": "output", "params": {"classes": 2}},
        ],
        "edges": [{"source": "in", "target": "out"}],
    }
    mid = client.post(
        f"/api/projects/{pid}/models", json={"name": "m", "dataset_id": did, "graph": graph}
    ).json()["id"]
    return pid, mid


def test_create_run_and_complete(client, monkeypatch, tmp_path):
    pid, mid = _prepared_model(client, monkeypatch, tmp_path)
    run = client.post(
        "/api/runs",
        json={"model_id": mid, "config": {"epochs": 2, "batch_size": 8, "devices": ["cpu"]}},
    ).json()
    rid = run["id"]
    for _ in range(240):
        got = client.get(f"/api/runs/{rid}").json()
        if got["status"] in ("completed", "failed"):
            break
        time.sleep(0.5)
    final = client.get(f"/api/runs/{rid}").json()
    assert final["status"] == "completed"
    assert len(final["metrics"]) == 2
    assert [r["id"] for r in client.get(f"/api/projects/{pid}/runs").json()] == [rid]


def test_create_run_without_pipeline_400(client, monkeypatch, tmp_path):
    monkeypatch.setenv("MODELROOM_WORKSPACE", str(tmp_path))
    pid = client.post("/api/projects", json={"name": "P"}).json()["id"]
    graph = {
        "nodes": [
            {"id": "in", "type": "input", "params": {"features": 2}},
            {"id": "out", "type": "output", "params": {"classes": 2}},
        ],
        "edges": [{"source": "in", "target": "out"}],
    }
    mid = client.post(
        f"/api/projects/{pid}/models", json={"name": "m", "dataset_id": None, "graph": graph}
    ).json()["id"]
    res = client.post("/api/runs", json={"model_id": mid, "config": {"epochs": 1}})
    assert res.status_code == 400
