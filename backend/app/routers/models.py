import json

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.db import get_session
from app.models import ModelDef, Project
from app.models_builder import shape_engine
from app.schemas import ModelGraph

router = APIRouter(prefix="/api", tags=["models"])


class ModelCreate(BaseModel):
    name: str = "model"
    dataset_id: int | None = None
    graph: ModelGraph = ModelGraph()


class ModelUpdate(BaseModel):
    name: str | None = None
    dataset_id: int | None = None
    graph: ModelGraph | None = None


def _read(model: ModelDef) -> dict:
    return {
        "id": model.id,
        "project_id": model.project_id,
        "dataset_id": model.dataset_id,
        "name": model.name,
        "graph": json.loads(model.graph_json),
    }


@router.post("/model/validate")
def validate_model(graph: ModelGraph):
    nodes = [n.model_dump() for n in graph.nodes]
    edges = [e.model_dump() for e in graph.edges]
    return shape_engine.validate(nodes, edges, graph.input_features)


@router.post("/projects/{project_id}/models", status_code=status.HTTP_201_CREATED)
def create_model(
    project_id: int, body: ModelCreate, session: Session = Depends(get_session)
):
    if session.get(Project, project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")
    model = ModelDef(
        project_id=project_id,
        dataset_id=body.dataset_id,
        name=body.name,
        graph_json=json.dumps(body.graph.model_dump()),
    )
    session.add(model)
    session.commit()
    session.refresh(model)
    return _read(model)


@router.get("/projects/{project_id}/models")
def list_models(project_id: int, session: Session = Depends(get_session)):
    rows = session.exec(
        select(ModelDef).where(ModelDef.project_id == project_id).order_by(ModelDef.created_at.desc())
    ).all()
    return [_read(m) for m in rows]


@router.get("/models/{model_id}")
def get_model(model_id: int, session: Session = Depends(get_session)):
    model = session.get(ModelDef, model_id)
    if model is None:
        raise HTTPException(status_code=404, detail="Model not found")
    return _read(model)


@router.put("/models/{model_id}")
def update_model(
    model_id: int, body: ModelUpdate, session: Session = Depends(get_session)
):
    model = session.get(ModelDef, model_id)
    if model is None:
        raise HTTPException(status_code=404, detail="Model not found")
    if body.name is not None:
        model.name = body.name
    if body.dataset_id is not None:
        model.dataset_id = body.dataset_id
    if body.graph is not None:
        model.graph_json = json.dumps(body.graph.model_dump())
    session.add(model)
    session.commit()
    session.refresh(model)
    return _read(model)
