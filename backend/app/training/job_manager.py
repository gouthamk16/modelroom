import json
import subprocess
import sys
from pathlib import Path

from app.training import runs_store

_procs: dict[int, subprocess.Popen] = {}

_BACKEND_ROOT = Path(__file__).resolve().parents[2]


def _spec_path(run_id: int) -> Path:
    return runs_store.run_dir(run_id) / "spec.json"


def start(run_id: int, spec: dict, resume: bool = False) -> None:
    runs_store.clear_pause(run_id)
    _spec_path(run_id).write_text(json.dumps(spec), encoding="utf-8")
    args = [sys.executable, "-m", "app.training.train_entry", "--spec", str(_spec_path(run_id))]
    if resume:
        args.append("--resume")
    log = runs_store.log_path(run_id).open("a", encoding="utf-8")
    _procs[run_id] = subprocess.Popen(
        args, cwd=str(_BACKEND_ROOT), stdout=log, stderr=subprocess.STDOUT
    )


def is_running(run_id: int) -> bool:
    p = _procs.get(run_id)
    return p is not None and p.poll() is None


def pause(run_id: int) -> None:
    runs_store.request_pause(run_id)


def stop(run_id: int) -> None:
    p = _procs.get(run_id)
    if p is not None and p.poll() is None:
        p.terminate()


def exit_code(run_id: int) -> int | None:
    p = _procs.get(run_id)
    return None if p is None else p.poll()
