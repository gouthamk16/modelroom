def _graph():
    return {
        "nodes": [
            {"id": "in", "type": "input", "params": {"features": 8}},
            {"id": "l1", "type": "linear", "params": {"out_features": 16}},
            {"id": "out", "type": "output", "params": {"classes": 2}},
        ],
        "edges": [
            {"source": "in", "target": "l1"},
            {"source": "l1", "target": "out"},
        ],
        "input_features": None,
    }


def test_validate_endpoint(client):
    rep = client.post("/api/model/validate", json=_graph()).json()
    assert rep["valid"] is True
    assert rep["total_params"] == (8 * 16 + 16) + (16 * 2 + 2)


def test_create_list_get_update_model(client):
    pid = client.post("/api/projects", json={"name": "P"}).json()["id"]

    created = client.post(
        f"/api/projects/{pid}/models",
        json={"name": "mlp-a", "dataset_id": None, "graph": _graph()},
    )
    assert created.status_code == 201
    mid = created.json()["id"]

    # second model in the same project
    client.post(f"/api/projects/{pid}/models", json={"name": "mlp-b", "graph": _graph()})

    models = client.get(f"/api/projects/{pid}/models").json()
    assert {m["name"] for m in models} == {"mlp-a", "mlp-b"}

    got = client.get(f"/api/models/{mid}").json()
    assert got["name"] == "mlp-a"
    assert got["graph"]["nodes"][1]["params"]["out_features"] == 16

    g2 = _graph()
    g2["nodes"][1]["params"]["out_features"] = 32
    upd = client.put(f"/api/models/{mid}", json={"name": "mlp-a2", "graph": g2})
    assert upd.status_code == 200
    after = client.get(f"/api/models/{mid}").json()
    assert after["name"] == "mlp-a2"
    assert after["graph"]["nodes"][1]["params"]["out_features"] == 32


def test_create_model_in_missing_project_404(client):
    assert client.post("/api/projects/999/models", json={"name": "x"}).status_code == 404
