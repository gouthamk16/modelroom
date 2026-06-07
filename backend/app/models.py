from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Project(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    description: str = ""
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)


class Dataset(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    filename: str
    n_rows: int = 0
    n_cols: int = 0
    size_bytes: int = 0
    created_at: datetime = Field(default_factory=_now)


class Preparation(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    dataset_id: int = Field(foreign_key="dataset.id", index=True)
    target: str
    steps_json: str = "[]"
    summary_json: str = "{}"
    created_at: datetime = Field(default_factory=_now)


class ModelDef(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", index=True)
    dataset_id: int | None = Field(default=None, foreign_key="dataset.id")
    name: str = "model"
    graph_json: str = "{}"
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)
