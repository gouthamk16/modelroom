import asyncio
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlmodel import Session, select


def _now() -> datetime:
    return datetime.now(timezone.utc)

from app.db import get_session
from app.models import ModelDef, Preparation, Run
from app.schemas import RunCreate
from app.training import job_manager, runs_store

router = APIRouter(prefix="/api", tags=["runs"])


def _prep_for(model: ModelDef, session: Session) -> Preparation:
    prep = None
    if model.dataset_id is not None:
        prep = session.exec(
            select(Preparation).where(Preparation.dataset_id == model.dataset_id)
        ).first()
    if prep is None:
        raise HTTPException(
            status_code=400,
            detail="The model's dataset has no applied preprocessing pipeline",
        )
    return prep


def _spec(run: Run, model: ModelDef, prep: Preparation) -> dict:
    graph = json.loads(model.graph_json)
    summary = json.loads(prep.summary_json)
    return {
        "run_id": run.id,
        "prep_id": prep.id,
        "task": summary.get("task", "classification"),
        "nodes": graph.get("nodes", []),
        "edges": graph.get("edges", []),
        "config": json.loads(run.config_json),
    }


def _summarize(run_id: int) -> dict:
    metrics = runs_store.read_metrics(run_id)
    if not metrics:
        return {}
    best = max(metrics, key=lambda m: m.get("val_acc", 0))
    return {
        "epochs": metrics[-1]["epoch"],
        "best_val_acc": best.get("val_acc", 0),
        "final_val_loss": metrics[-1].get("val_loss"),
    }


def _sync_status(run: Run, session: Session) -> Run:
    if run.status == "running" and run.id is not None and not job_manager.is_running(run.id):
        code = job_manager.exit_code(run.id)
        if runs_store.pause_requested(run.id):
            run.status = "paused"
        elif code == 0 or code is None:
            run.status = "completed"
        else:
            run.status = "failed"
        metrics = runs_store.read_metrics(run.id)
        if metrics:
            run.last_epoch = metrics[-1]["epoch"]
        run.summary_json = json.dumps(_summarize(run.id))
        if run.status in ("completed", "failed") and run.finished_at is None:
            run.finished_at = _now()
        session.add(run)
        session.commit()
        session.refresh(run)
    return run


def _read(run: Run) -> dict:
    return {
        "id": run.id,
        "project_id": run.project_id,
        "model_id": run.model_id,
        "status": run.status,
        "last_epoch": run.last_epoch,
        "config": json.loads(run.config_json),
        "summary": json.loads(run.summary_json),
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "finished_at": run.finished_at.isoformat() if run.finished_at else None,
    }


@router.post("/runs")
def create_run(body: RunCreate, session: Session = Depends(get_session)):
    model = session.get(ModelDef, body.model_id)
    if model is None:
        raise HTTPException(status_code=404, detail="Model not found")
    prep = _prep_for(model, session)
    run = Run(
        project_id=model.project_id,
        model_id=model.id,
        status="running",
        config_json=json.dumps(body.config.model_dump()),
        started_at=_now(),
    )
    session.add(run)
    session.commit()
    session.refresh(run)
    job_manager.start(run.id, _spec(run, model, prep))
    return _read(run)


@router.get("/projects/{project_id}/runs")
def list_runs(project_id: int, session: Session = Depends(get_session)):
    runs = session.exec(
        select(Run).where(Run.project_id == project_id).order_by(Run.created_at.desc())
    ).all()
    return [_read(_sync_status(r, session)) for r in runs]


@router.get("/runs/{run_id}")
def get_run(run_id: int, session: Session = Depends(get_session)):
    run = session.get(Run, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    run = _sync_status(run, session)
    return {
        **_read(run),
        "metrics": runs_store.read_metrics(run_id),
        "log": runs_store.read_log(run_id),
        "eval": runs_store.read_eval(run_id),
    }


@router.post("/runs/{run_id}/pause")
def pause_run(run_id: int, session: Session = Depends(get_session)):
    if session.get(Run, run_id) is None:
        raise HTTPException(status_code=404, detail="Run not found")
    job_manager.pause(run_id)
    return {"ok": True}


@router.post("/runs/{run_id}/resume")
def resume_run(run_id: int, session: Session = Depends(get_session)):
    run = session.get(Run, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    model = session.get(ModelDef, run.model_id)
    prep = _prep_for(model, session)
    runs_store.clear_pause(run_id)
    run.status = "running"
    session.add(run)
    session.commit()
    job_manager.start(run_id, _spec(run, model, prep), resume=True)
    return {"ok": True}


@router.post("/runs/{run_id}/stop")
def stop_run(run_id: int, session: Session = Depends(get_session)):
    run = session.get(Run, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    job_manager.stop(run_id)
    run.status = "stopped"
    run.finished_at = _now()
    session.add(run)
    session.commit()
    return {"ok": True}


@router.websocket("/runs/{run_id}/stream")
async def stream(websocket: WebSocket, run_id: int):
    await websocket.accept()
    sent = 0
    try:
        while True:
            metrics = runs_store.read_metrics(run_id)
            for m in metrics[sent:]:
                await websocket.send_json({"type": "metric", "data": m})
            sent = len(metrics)
            if not job_manager.is_running(run_id):
                await websocket.send_json({"type": "done"})
                break
            await asyncio.sleep(0.5)
    except WebSocketDisconnect:
        pass
