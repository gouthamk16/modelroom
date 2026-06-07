import json

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.db import get_session
from app.models import ModelDef, Preparation, Project
from app.models_builder import shape_engine
from app.schemas import ModelGraph

router = APIRouter(prefix="/api", tags=["models"])


def _starter_graph(dataset_id: int | None, session: Session) -> dict:
    """A default input->output graph, sized to the dataset's preprocessing if available."""
    features, classes = 8, 2
    if dataset_id is not None:
        prep = session.exec(
            select(Preparation).where(Preparation.dataset_id == dataset_id)
        ).first()
        if prep is not None:
            summary = json.loads(prep.summary_json)
            features = int(summary.get("n_features") or features)
            classes = (
                int(summary.get("n_classes") or 0)
                if summary.get("task") == "classification"
                else 1
            ) or classes
    return {
        "nodes": [
            {"id": "input", "type": "input", "params": {"features": features}, "x": 60, "y": 160},
            {"id": "output", "type": "output", "params": {"classes": classes}, "x": 460, "y": 160},
        ],
        "edges": [{"source": "input", "target": "output"}],
        "input_features": features,
    }


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
    graph = body.graph.model_dump()
    if not graph.get("nodes"):
        graph = _starter_graph(body.dataset_id, session)
    model = ModelDef(
        project_id=project_id,
        dataset_id=body.dataset_id,
        name=body.name,
        graph_json=json.dumps(graph),
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
