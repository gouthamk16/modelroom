from datetime import datetime

from pydantic import BaseModel


class ProjectCreate(BaseModel):
    name: str
    description: str = ""


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class ProjectRead(BaseModel):
    id: int
    name: str
    description: str
    created_at: datetime
    updated_at: datetime


class DatasetRead(BaseModel):
    id: int
    project_id: int
    name: str
    filename: str
    n_rows: int
    n_cols: int
    size_bytes: int
    created_at: datetime
