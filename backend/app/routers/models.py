import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app.db import get_session
from app.models import ModelDef, Project
from app.models_builder import shape_engine
from app.schemas import ModelGraph

router = APIRouter(prefix="/api", tags=["models"])


class ModelSave(BaseModel):
    name: str = "model"
    graph: ModelGraph


@router.post("/model/validate")
def validate_model(graph: ModelGraph):
    nodes = [n.model_dump() for n in graph.nodes]
    return shape_engine.validate(nodes, graph.input_features)


@router.put("/projects/{project_id}/model")
def save_model(
    project_id: int, body: ModelSave, session: Session = Depends(get_session)
):
    if session.get(Project, project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")
    existing = session.exec(
        select(ModelDef).where(ModelDef.project_id == project_id)
    ).first()
    model = existing or ModelDef(project_id=project_id)
    model.name = body.name
    model.graph_json = json.dumps(body.graph.model_dump())
    session.add(model)
    session.commit()
    session.refresh(model)
    return {"id": model.id, "name": model.name}


@router.get("/projects/{project_id}/model")
def get_model(project_id: int, session: Session = Depends(get_session)):
    model = session.exec(
        select(ModelDef).where(ModelDef.project_id == project_id)
    ).first()
    if model is None:
        raise HTTPException(status_code=404, detail="No model")
    return {"id": model.id, "name": model.name, "graph": json.loads(model.graph_json)}
