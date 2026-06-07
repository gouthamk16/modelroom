import io


def _upload(client, project_id):
    csv = b"age,city\n20,NY\n30,LA\n40,NY\n"
    return client.post(
        f"/api/projects/{project_id}/datasets",
        files={"file": ("churn.csv", io.BytesIO(csv), "text/csv")},
    )


def test_upload_then_fetch_metadata_and_views(client, monkeypatch, tmp_path):
    monkeypatch.setenv("MODELROOM_WORKSPACE", str(tmp_path))
    pid = client.post("/api/projects", json={"name": "P"}).json()["id"]

    res = _upload(client, pid)
    assert res.status_code == 201
    ds = res.json()
    assert ds["n_rows"] == 3
    assert ds["n_cols"] == 2

    did = ds["id"]
    assert [d["id"] for d in client.get("/api/datasets").json()] == [did]

    schema = client.get(f"/api/datasets/{did}/schema").json()
    assert {c["name"] for c in schema} == {"age", "city"}

    preview = client.get(f"/api/datasets/{did}/preview").json()
    assert preview["rows"][0]["city"] == "NY"

    hist = client.get(f"/api/datasets/{did}/histogram", params={"column": "city"}).json()
    assert hist["kind"] == "categorical"


def test_upload_to_missing_project_404(client, monkeypatch, tmp_path):
    monkeypatch.setenv("MODELROOM_WORKSPACE", str(tmp_path))
    assert _upload(client, 999).status_code == 404
