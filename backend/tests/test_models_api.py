def _graph():
    return {
        "nodes": [
            {"id": "in", "type": "input", "params": {"features": 8}},
            {"id": "l1", "type": "linear", "params": {"out_features": 16}},
            {"id": "out", "type": "output", "params": {"classes": 2}},
        ],
        "input_features": None,
    }


def test_validate_endpoint(client):
    rep = client.post("/api/model/validate", json=_graph()).json()
    assert rep["valid"] is True
    assert rep["total_params"] == (8 * 16 + 16) + (16 * 2 + 2)


def test_save_and_get_model(client):
    pid = client.post("/api/projects", json={"name": "P"}).json()["id"]
    save = client.put(f"/api/projects/{pid}/model", json={"name": "mlp", "graph": _graph()})
    assert save.status_code == 200

    got = client.get(f"/api/projects/{pid}/model").json()
    assert got["name"] == "mlp"
    assert got["graph"]["nodes"][1]["params"]["out_features"] == 16
