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
    name: str
    filename: str
    n_rows: int
    n_cols: int
    size_bytes: int
    created_at: datetime


class PipelineStep(BaseModel):
    type: str
    params: dict = {}


class PipelineSpec(BaseModel):
    target: str
    steps: list[PipelineStep] = []
    train_ratio: float = 0.7
    val_ratio: float = 0.15
    seed: int = 42


class LayerNode(BaseModel):
    id: str
    type: str
    params: dict = {}
    x: float = 0
    y: float = 0


class Edge(BaseModel):
    source: str
    target: str


class ModelGraph(BaseModel):
    nodes: list[LayerNode] = []
    edges: list[Edge] = []
    input_features: int | None = None


class RunConfig(BaseModel):
    optimizer: str = "adam"
    lr: float = 0.001
    epochs: int = 20
    batch_size: int = 32
    devices: list[str] = ["cpu"]


class RunCreate(BaseModel):
    model_id: int
    config: RunConfig = RunConfig()
