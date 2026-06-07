import os
from pathlib import Path


class Settings:
    def __init__(self) -> None:
        env = os.environ.get("MODELROOM_WORKSPACE")
        self.workspace_dir: Path = Path(env) if env else Path.home() / ".modelroom"

    @property
    def db_path(self) -> Path:
        return self.workspace_dir / "modelroom.db"

    @property
    def datasets_dir(self) -> Path:
        return self.workspace_dir / "datasets"

    @property
    def runs_dir(self) -> Path:
        return self.workspace_dir / "runs"

    @property
    def models_dir(self) -> Path:
        return self.workspace_dir / "models"

    def ensure_dirs(self) -> None:
        for p in (self.workspace_dir, self.datasets_dir, self.runs_dir, self.models_dir):
            p.mkdir(parents=True, exist_ok=True)


def get_settings() -> Settings:
    return Settings()
