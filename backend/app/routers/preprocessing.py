import json

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.datasets import store as dataset_store
from app.db import get_session
from app.models import Dataset, Preparation
from app.preprocessing import pipeline
from app.preprocessing import store as prep_store
from app.schemas import PipelineSpec

router = APIRouter(prefix="/api/datasets", tags=["preprocessing"])


def _get_prep(dataset_id: int, session: Session) -> Preparation | None:
    return session.exec(
        select(Preparation).where(Preparation.dataset_id == dataset_id)
    ).first()


@router.put("/{dataset_id}/pipeline")
def save_pipeline(
    dataset_id: int, spec: PipelineSpec, session: Session = Depends(get_session)
):
    if session.get(Dataset, dataset_id) is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    prep = _get_prep(dataset_id, session)
    if prep is None:
        prep = Preparation(dataset_id=dataset_id, target=spec.target)
    prep.target = spec.target
    prep.steps_json = json.dumps(spec.model_dump()["steps"])
    session.add(prep)
    session.commit()
    session.refresh(prep)
    return {"id": prep.id, "target": prep.target}


@router.get("/{dataset_id}/pipeline")
def get_pipeline(dataset_id: int, session: Session = Depends(get_session)):
    prep = _get_prep(dataset_id, session)
    if prep is None:
        raise HTTPException(status_code=404, detail="No pipeline")
    return {
        "id": prep.id,
        "target": prep.target,
        "steps": json.loads(prep.steps_json),
        "summary": json.loads(prep.summary_json),
    }


@router.post("/{dataset_id}/pipeline/apply")
def apply_pipeline(dataset_id: int, session: Session = Depends(get_session)):
    prep = _get_prep(dataset_id, session)
    if prep is None:
        raise HTTPException(status_code=404, detail="No pipeline")
    df = dataset_store.load_df(dataset_id)
    spec = {"target": prep.target, "steps": json.loads(prep.steps_json)}
    out = pipeline.prepare(df, spec)
    prep_store.save_prepared(prep.id, out)
    summary = pipeline.summarize(out)
    prep.summary_json = json.dumps(summary)
    session.add(prep)
    session.commit()
    return summary
