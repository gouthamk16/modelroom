from pathlib import Path

from app.config import Settings


def test_workspace_dir_defaults_under_home():
    s = Settings()
    assert s.workspace_dir == Path.home() / ".modelroom"


def test_workspace_dir_env_override(monkeypatch, tmp_path):
    monkeypatch.setenv("MODELROOM_WORKSPACE", str(tmp_path))
    s = Settings()
    assert s.workspace_dir == tmp_path
    assert s.db_path == tmp_path / "modelroom.db"
