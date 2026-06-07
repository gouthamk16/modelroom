import time

import numpy as np

from app.preprocessing import store as prep_store
from app.training import job_manager, runs_store


def test_spawn_and_complete(monkeypatch, tmp_path):
    monkeypatch.setenv("MODELROOM_WORKSPACE", str(tmp_path))
    rng = np.random.default_rng(0)
    prep_store.save_prepared(
        2,
        {
            "X_train": rng.standard_normal((20, 3)).astype("float32"),
            "y_train": rng.integers(0, 2, 20),
            "X_val": rng.standard_normal((6, 3)).astype("float32"),
            "y_val": rng.integers(0, 2, 6),
            "X_test": rng.standard_normal((6, 3)).astype("float32"),
            "y_test": rng.integers(0, 2, 6),
        },
    )
    spec = {
        "run_id": 9,
        "prep_id": 2,
        "task": "classification",
        "nodes": [
            {"id": "in", "type": "input", "params": {"features": 3}},
            {"id": "out", "type": "output", "params": {"classes": 2}},
        ],
        "edges": [{"source": "in", "target": "out"}],
        "config": {"optimizer": "adam", "lr": 0.01, "epochs": 2, "batch_size": 8, "devices": ["cpu"]},
    }
    job_manager.start(9, spec)
    for _ in range(240):
        if not job_manager.is_running(9):
            break
        time.sleep(0.5)
    assert not job_manager.is_running(9)
    assert len(runs_store.read_metrics(9)) == 2
    assert job_manager.exit_code(9) == 0
