def test_run_dir_and_metrics(monkeypatch, tmp_path):
    monkeypatch.setenv("MODELROOM_WORKSPACE", str(tmp_path))
    from app.training import runs_store

    runs_store.append_metric(3, {"epoch": 1, "loss": 0.5})
    runs_store.append_metric(3, {"epoch": 2, "loss": 0.4})
    metrics = runs_store.read_metrics(3)
    assert [m["epoch"] for m in metrics] == [1, 2]
    assert runs_store.run_dir(3).exists()


def test_pause_flag(monkeypatch, tmp_path):
    monkeypatch.setenv("MODELROOM_WORKSPACE", str(tmp_path))
    from app.training import runs_store

    assert runs_store.pause_requested(3) is False
    runs_store.request_pause(3)
    assert runs_store.pause_requested(3) is True
    runs_store.clear_pause(3)
    assert runs_store.pause_requested(3) is False
