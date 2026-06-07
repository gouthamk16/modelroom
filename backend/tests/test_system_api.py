def test_devices_always_includes_cpu(client):
    devices = client.get("/api/system/devices").json()
    assert any(d["id"] == "cpu" for d in devices)
    for d in devices:
        assert {"id", "name", "kind"} <= set(d)
