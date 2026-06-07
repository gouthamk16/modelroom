def test_create_and_list_project(client):
    res = client.post("/api/projects", json={"name": "Churn", "description": "tabular"})
    assert res.status_code == 201
    created = res.json()
    assert created["id"] > 0
    assert created["name"] == "Churn"

    res = client.get("/api/projects")
    assert res.status_code == 200
    assert [p["name"] for p in res.json()] == ["Churn"]


def test_get_update_delete_project(client):
    pid = client.post("/api/projects", json={"name": "A"}).json()["id"]

    assert client.get(f"/api/projects/{pid}").json()["name"] == "A"

    res = client.patch(f"/api/projects/{pid}", json={"name": "B"})
    assert res.status_code == 200
    assert res.json()["name"] == "B"

    assert client.delete(f"/api/projects/{pid}").status_code == 204
    assert client.get(f"/api/projects/{pid}").status_code == 404
