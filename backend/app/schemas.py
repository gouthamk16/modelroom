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
