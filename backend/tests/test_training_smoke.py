import numpy as np

from app.preprocessing import store as prep_store
from app.training import runs_store, train_entry


def _seed_prepared(prep_id):
    rng = np.random.default_rng(0)
    arrays = {
        "X_train": rng.standard_normal((40, 4)).astype("float32"),
        "y_train": rng.integers(0, 3, 40),
        "X_val": rng.standard_normal((10, 4)).astype("float32"),
        "y_val": rng.integers(0, 3, 10),
        "X_test": rng.standard_normal((10, 4)).astype("float32"),
        "y_test": rng.integers(0, 3, 10),
    }
    prep_store.save_prepared(prep_id, arrays)


def _graph():
    nodes = [
        {"id": "in", "type": "input", "params": {"features": 4}},
        {"id": "l1", "type": "linear", "params": {"out_features": 8}},
        {"id": "out", "type": "output", "params": {"classes": 3}},
    ]
    edges = [{"source": "in", "target": "l1"}, {"source": "l1", "target": "out"}]
    return nodes, edges


def test_train_writes_metrics(monkeypatch, tmp_path):
    monkeypatch.setenv("MODELROOM_WORKSPACE", str(tmp_path))
    _seed_prepared(7)
    nodes, edges = _graph()
    cfg = {"optimizer": "adam", "lr": 0.01, "epochs": 3, "batch_size": 16, "devices": ["cpu"]}

    train_entry.run_training(
        run_id=5, prep_id=7, nodes=nodes, edges=edges, task="classification", config=cfg
    )

    metrics = runs_store.read_metrics(5)
    assert len(metrics) == 3
    assert metrics[-1]["epoch"] == 3
    assert "train_loss" in metrics[-1] and "val_acc" in metrics[-1]
    assert runs_store.latest_checkpoint(5) is not None


def test_pause_then_resume(monkeypatch, tmp_path):
    monkeypatch.setenv("MODELROOM_WORKSPACE", str(tmp_path))
    _seed_prepared(7)
    nodes, edges = _graph()
    cfg = {"optimizer": "adam", "lr": 0.01, "epochs": 6, "batch_size": 16, "devices": ["cpu"]}

    runs_store.request_pause(6)
    status = train_entry.run_training(6, 7, nodes, edges, "classification", cfg)
    assert status == "paused"
    assert len(runs_store.read_metrics(6)) == 0

    runs_store.clear_pause(6)
    status = train_entry.run_training(6, 7, nodes, edges, "classification", cfg, resume=True)
    assert status == "completed"
    total = runs_store.read_metrics(6)
    assert total[-1]["epoch"] == 6
