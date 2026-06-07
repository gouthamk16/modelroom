import numpy as np


def test_save_and_load_prepared(monkeypatch, tmp_path):
    monkeypatch.setenv("MODELROOM_WORKSPACE", str(tmp_path))
    from app.preprocessing import store

    arrays = {
        "X_train": np.ones((3, 2), dtype="float32"),
        "y_train": np.array([0, 1, 0]),
    }
    store.save_prepared(5, arrays)
    loaded = store.load_prepared(5)
    assert loaded["X_train"].shape == (3, 2)
    assert store.prepared_path(5).exists()
