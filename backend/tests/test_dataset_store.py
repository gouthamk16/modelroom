def test_save_and_load_roundtrip(monkeypatch, tmp_path):
    monkeypatch.setenv("MODELROOM_WORKSPACE", str(tmp_path))
    from app.datasets import store

    store.save_csv(7, b"a,b\n1,2\n3,4\n")
    df = store.load_df(7)
    assert list(df.columns) == ["a", "b"]
    assert df.shape == (2, 2)
    assert store.dataset_path(7).exists()
