import json
from pathlib import Path

from app.config import get_settings


def run_dir(run_id: int) -> Path:
    d = get_settings().runs_dir / str(run_id)
    (d / "checkpoints").mkdir(parents=True, exist_ok=True)
    return d


def metrics_path(run_id: int) -> Path:
    return run_dir(run_id) / "metrics.jsonl"


def log_path(run_id: int) -> Path:
    return run_dir(run_id) / "log.txt"


def append_metric(run_id: int, point: dict) -> None:
    with metrics_path(run_id).open("a", encoding="utf-8") as f:
        f.write(json.dumps(point) + "\n")


def read_metrics(run_id: int) -> list[dict]:
    p = metrics_path(run_id)
    if not p.exists():
        return []
    return [json.loads(line) for line in p.read_text(encoding="utf-8").splitlines() if line.strip()]


def append_log(run_id: int, line: str) -> None:
    with log_path(run_id).open("a", encoding="utf-8") as f:
        f.write(line.rstrip() + "\n")


def read_log(run_id: int) -> str:
    p = log_path(run_id)
    return p.read_text(encoding="utf-8") if p.exists() else ""


def _pause_flag(run_id: int) -> Path:
    return run_dir(run_id) / "PAUSE"


def request_pause(run_id: int) -> None:
    _pause_flag(run_id).write_text("1", encoding="utf-8")


def clear_pause(run_id: int) -> None:
    _pause_flag(run_id).unlink(missing_ok=True)


def pause_requested(run_id: int) -> bool:
    return _pause_flag(run_id).exists()


def latest_checkpoint(run_id: int) -> Path | None:
    ckpts = sorted((run_dir(run_id) / "checkpoints").glob("epoch_*.pt"))
    return ckpts[-1] if ckpts else None
