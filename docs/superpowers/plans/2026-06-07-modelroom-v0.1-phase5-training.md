# ModelRoom v0.1 — Phase 5: Training & Compute Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Train a built model on its prepared dataset, on the user-selected device(s), as a managed subprocess job — with live loss/metric streaming over WebSocket, checkpointing + pause/resume, a Jobs view, and run comparison + model versioning.

**Architecture:** A pure `compiler` turns the model graph (nodes+edges, topologically ordered) into a PyTorch `nn.Module`. A standalone `train_entry.py` loads the dataset's prepared `.npz`, builds the module, trains per a config, and appends metrics to `runs/<id>/metrics.jsonl` + logs to `runs/<id>/log.txt`, writing checkpoints to `runs/<id>/checkpoints/`. A `job_manager` spawns/tracks/stops these subprocesses; pause is a cooperative flag file the trainer checkpoints-and-exits on; resume re-spawns from the latest checkpoint. The API exposes run CRUD + control; a WebSocket tails metrics/logs. The frontend adds a training config+launch panel, a live run view (Recharts + console + controls), a Jobs page, run comparison, and model duplication (versioning).

**Tech Stack:** Adds `torch` (CUDA 12.4 build). Reuses Phase 1–4 stack + Playwright.

**Builds on:** Phase 4 (model graph, `shape_engine`), Phase 3 (`Preparation` + prepared npz), device selector (`/api/system/devices`). Branch `phase5-training`.

**Run contract:** a run trains `model.graph` on the prepared arrays of the model's `dataset_id` (the dataset must have an applied pipeline / `Preparation`). Config: optimizer (`adam|sgd`), lr, epochs, batch_size, loss (auto from task), device(s).

---

## File Structure

**Backend**
- Modify `pyproject.toml` — add `torch`.
- Modify `app/models.py` — add `Run`, `Checkpoint`.
- Modify `app/schemas.py` — add `RunCreate`, `RunRead`.
- Create `app/models_builder/compiler.py` — graph → `nn.Module` (pure, torch).
- Create `app/training/__init__.py`, `app/training/train_entry.py` — standalone training process.
- Create `app/training/job_manager.py` — subprocess lifecycle.
- Create `app/training/runs_store.py` — run dir paths + metrics/log/checkpoint IO.
- Create `app/routers/runs.py` — run CRUD + control + WebSocket.
- Modify `app/main.py` — include runs router.
- Tests: `test_compiler.py`, `test_runs_store.py`, `test_training_smoke.py` (CPU, 1–2 epochs incl. pause→resume), `test_runs_api.py`.

**Frontend**
- Modify `src/lib/types.ts` — `Run`, `RunConfig`, `RunMetricPoint`.
- Modify `src/api/client.ts` — run endpoints + `runSocket()` helper.
- Create `src/lib/useRunStream.ts` — WebSocket hook (live metrics/log, replay).
- Create `src/components/training/TrainPanel.tsx` — config + launch (device picker from localStorage).
- Create `src/components/training/RunView.tsx` — live charts + console + pause/resume/stop.
- Create `src/pages/JobsPage.tsx` — runs list + open run + compare.
- Create `src/components/training/RunCompare.tsx` — overlay curves + metrics table.
- Modify `src/pages/ModelBuilder.tsx` — "Train" action → create run → open RunView.
- Modify `src/pages/ModelsPage.tsx` — "Duplicate" (versioning) on model cards.
- Modify `src/App.tsx` — Jobs route.
- Tests: `compiler`-mirroring graph test already exists; add `JobsPage`/`RunCompare` component tests; extend E2E with a tiny CPU training run.

---

## Task 1: Run + Checkpoint models and schemas

**Files:** Modify `app/models.py`, `app/schemas.py`; Test `tests/test_models.py`.

- [ ] **Step 1: Failing test (append to `tests/test_models.py`)**

```python
def test_run_defaults():
    from app.models import Run

    r = Run(model_id=1, project_id=1, config_json="{}")
    assert r.status == "queued"
    assert r.model_id == 1
```

- [ ] **Step 2: Run → FAIL**

`.venv/Scripts/python -m pytest tests/test_models.py::test_run_defaults -v`

- [ ] **Step 3: Add to `app/models.py`**

```python
class Run(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", index=True)
    model_id: int = Field(foreign_key="modeldef.id", index=True)
    status: str = "queued"  # queued|running|paused|completed|failed|stopped
    config_json: str = "{}"
    summary_json: str = "{}"  # final metrics, best epoch, params, duration
    last_epoch: int = 0
    created_at: datetime = Field(default_factory=_now)
    started_at: datetime | None = None
    finished_at: datetime | None = None
```

- [ ] **Step 4: Add to `app/schemas.py`**

```python
class RunConfig(BaseModel):
    optimizer: str = "adam"
    lr: float = 0.001
    epochs: int = 20
    batch_size: int = 32
    devices: list[str] = ["cpu"]


class RunCreate(BaseModel):
    model_id: int
    config: RunConfig = RunConfig()
```

- [ ] **Step 5: Run → PASS**, then **Commit**

```bash
git add backend/app/models.py backend/app/schemas.py backend/tests/test_models.py
git commit -m "feat(backend): add Run model + run config schemas"
```

---

## Task 2: PyTorch dependency

**Files:** Modify `pyproject.toml`.

- [ ] **Step 1: Add to `dependencies` in `pyproject.toml`**

```toml
    "torch>=2.4",
```

- [ ] **Step 2: Install the CUDA build (done out-of-band during planning)**

Run: `.venv/Scripts/python -m pip install torch --index-url https://download.pytorch.org/whl/cu124`
Verify: `.venv/Scripts/python -c "import torch;print(torch.__version__, torch.cuda.is_available())"`
Expected: prints a version; `True` if a CUDA GPU is present (CPU path still works if `False`).

- [ ] **Step 3: Commit**

```bash
git add backend/pyproject.toml
git commit -m "build(backend): add torch dependency"
```

---

## Task 3: Pure graph → nn.Module compiler

**Files:** Create `app/models_builder/compiler.py`; Test `tests/test_compiler.py`.

- [ ] **Step 1: Failing test `tests/test_compiler.py`**

```python
import torch

from app.models_builder import compiler


def _chain():
    nodes = [
        {"id": "in", "type": "input", "params": {"features": 4}},
        {"id": "l1", "type": "linear", "params": {"out_features": 8}},
        {"id": "a1", "type": "relu", "params": {}},
        {"id": "out", "type": "output", "params": {"classes": 3}},
    ]
    edges = [
        {"source": "in", "target": "l1"},
        {"source": "l1", "target": "a1"},
        {"source": "a1", "target": "out"},
    ]
    return nodes, edges


def test_compile_forward_shape():
    nodes, edges = _chain()
    module = compiler.build_module(nodes, edges)
    x = torch.randn(5, 4)
    y = module(x)
    assert y.shape == (5, 3)


def test_compile_param_count_matches_shape_engine():
    nodes, edges = _chain()
    module = compiler.build_module(nodes, edges)
    n = sum(p.numel() for p in module.parameters())
    assert n == (4 * 8 + 8) + (8 * 3 + 3)
```

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Write `app/models_builder/compiler.py`**

```python
import torch.nn as nn

# Ordered, sequential MLP compiler. Assumes a validated single-path graph
# (use shape_engine.validate first). Walks nodes in topological/edge order.


def _topo(nodes: list[dict], edges: list[dict]) -> list[dict]:
    by_id = {n["id"]: n for n in nodes}
    incoming = {n["id"]: 0 for n in nodes}
    nxt: dict[str, list[str]] = {n["id"]: [] for n in nodes}
    for e in edges:
        if e["source"] in by_id and e["target"] in by_id:
            incoming[e["target"]] += 1
            nxt[e["source"]].append(e["target"])
    queue = [nid for nid in by_id if incoming[nid] == 0]
    order = []
    while queue:
        nid = queue.pop(0)
        order.append(by_id[nid])
        for m in nxt[nid]:
            incoming[m] -= 1
            if incoming[m] == 0:
                queue.append(m)
    return order


def build_module(nodes: list[dict], edges: list[dict]) -> nn.Module:
    layers: list[nn.Module] = []
    dim = 0
    for node in _topo(nodes, edges):
        t = node["type"]
        p = node.get("params", {})
        if t == "input":
            dim = int(p.get("features", 0))
        elif t == "linear":
            o = int(p["out_features"])
            layers.append(nn.Linear(dim, o))
            dim = o
        elif t == "relu":
            layers.append(nn.ReLU())
        elif t == "dropout":
            layers.append(nn.Dropout(float(p.get("p", 0.5))))
        elif t == "batchnorm1d":
            layers.append(nn.BatchNorm1d(dim))
        elif t == "output":
            c = int(p["classes"])
            layers.append(nn.Linear(dim, c))
            dim = c
    return nn.Sequential(*layers)
```

- [ ] **Step 4: Run → PASS**, then **Commit**

```bash
git add backend/app/models_builder/compiler.py backend/tests/test_compiler.py
git commit -m "feat(backend): add graph->nn.Module compiler"
```

---

## Task 4: Runs store (paths + metrics/log/checkpoint IO)

**Files:** Create `app/training/__init__.py`, `app/training/runs_store.py`; Test `tests/test_runs_store.py`.

- [ ] **Step 1: Create `app/training/__init__.py`** (empty)

- [ ] **Step 2: Failing test `tests/test_runs_store.py`**

```python
def test_run_dir_and_metrics(monkeypatch, tmp_path):
    monkeypatch.setenv("MODELROOM_WORKSPACE", str(tmp_path))
    from app.training import runs_store

    runs_store.append_metric(3, {"epoch": 1, "loss": 0.5})
    runs_store.append_metric(3, {"epoch": 2, "loss": 0.4})
    metrics = runs_store.read_metrics(3)
    assert [m["epoch"] for m in metrics] == [1, 2]
    assert runs_store.run_dir(3).exists()


def test_pause_flag(monkeypatch, tmp_path):
    monkeypatch.setenv("MODELROOM_WORKSPACE", str(tmp_path))
    from app.training import runs_store

    assert runs_store.pause_requested(3) is False
    runs_store.request_pause(3)
    assert runs_store.pause_requested(3) is True
    runs_store.clear_pause(3)
    assert runs_store.pause_requested(3) is False
```

- [ ] **Step 3: Write `app/training/runs_store.py`**

```python
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
```

- [ ] **Step 4: Run → PASS**, then **Commit**

```bash
git add backend/app/training/__init__.py backend/app/training/runs_store.py backend/tests/test_runs_store.py
git commit -m "feat(backend): add runs store (metrics/log/pause/checkpoints)"
```

---

## Task 5: Training entrypoint (standalone, resumable)

**Files:** Create `app/training/train_entry.py`; Test `tests/test_training_smoke.py`.

- [ ] **Step 1: Failing test `tests/test_training_smoke.py`**

```python
import numpy as np

from app.preprocessing import store as prep_store
from app.training import runs_store, train_entry


def _seed_prepared(prep_id):
    rng = np.random.default_rng(0)
    arrays = {
        "X_train": rng.standard_normal((40, 4)).astype("float32"),
        "y_train": rng.integers(0, 3, 40),
        "X_val": rng.standard_normal((10, 4)).astype("float32"),
        "y_val": rng.integers(0, 3, 10),
        "X_test": rng.standard_normal((10, 4)).astype("float32"),
        "y_test": rng.integers(0, 3, 10),
    }
    prep_store.save_prepared(prep_id, arrays)


def _graph():
    nodes = [
        {"id": "in", "type": "input", "params": {"features": 4}},
        {"id": "l1", "type": "linear", "params": {"out_features": 8}},
        {"id": "out", "type": "output", "params": {"classes": 3}},
    ]
    edges = [{"source": "in", "target": "l1"}, {"source": "l1", "target": "out"}]
    return nodes, edges


def test_train_writes_metrics(monkeypatch, tmp_path):
    monkeypatch.setenv("MODELROOM_WORKSPACE", str(tmp_path))
    _seed_prepared(7)
    nodes, edges = _graph()
    cfg = {"optimizer": "adam", "lr": 0.01, "epochs": 3, "batch_size": 16, "devices": ["cpu"]}

    train_entry.run_training(
        run_id=5, prep_id=7, nodes=nodes, edges=edges, task="classification", config=cfg
    )

    metrics = runs_store.read_metrics(5)
    assert len(metrics) == 3
    assert metrics[-1]["epoch"] == 3
    assert "train_loss" in metrics[-1] and "val_acc" in metrics[-1]
    assert runs_store.latest_checkpoint(5) is not None


def test_pause_then_resume(monkeypatch, tmp_path):
    monkeypatch.setenv("MODELROOM_WORKSPACE", str(tmp_path))
    _seed_prepared(7)
    nodes, edges = _graph()
    cfg = {"optimizer": "adam", "lr": 0.01, "epochs": 6, "batch_size": 16, "devices": ["cpu"]}

    runs_store.request_pause(6)  # pause before it starts -> stops after 1 epoch
    train_entry.run_training(6, 7, nodes, edges, "classification", cfg)
    paused_epochs = len(runs_store.read_metrics(6))
    assert paused_epochs >= 1

    runs_store.clear_pause(6)
    train_entry.run_training(6, 7, nodes, edges, "classification", cfg, resume=True)
    total = runs_store.read_metrics(6)
    assert total[-1]["epoch"] == 6
```

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Write `app/training/train_entry.py`**

```python
import argparse
import json
import time

import numpy as np
import torch
import torch.nn as nn

from app.models_builder import compiler
from app.preprocessing import store as prep_store
from app.training import runs_store


def _pick_device(devices: list[str]) -> torch.device:
    for d in devices:
        if d.startswith("cuda") and torch.cuda.is_available():
            return torch.device(d)
    return torch.device("cpu")


def _loader(X, y, batch_size, device):
    xt = torch.tensor(X, dtype=torch.float32, device=device)
    yt = torch.tensor(np.asarray(y), device=device)
    n = xt.shape[0]
    for i in range(0, n, batch_size):
        yield xt[i : i + batch_size], yt[i : i + batch_size]


def run_training(run_id, prep_id, nodes, edges, task, config, resume=False):
    device = _pick_device(config.get("devices", ["cpu"]))
    data = prep_store.load_prepared(prep_id)
    module = compiler.build_module(nodes, edges).to(device)

    if task == "classification":
        loss_fn = nn.CrossEntropyLoss()
        y_train = data["y_train"].astype("int64")
        y_val = data["y_val"].astype("int64")
    else:
        loss_fn = nn.MSELoss()
        y_train = data["y_train"].astype("float32")
        y_val = data["y_val"].astype("float32")

    opt_name = config.get("optimizer", "adam")
    lr = float(config.get("lr", 1e-3))
    optimizer = (
        torch.optim.Adam(module.parameters(), lr=lr)
        if opt_name == "adam"
        else torch.optim.SGD(module.parameters(), lr=lr)
    )

    start_epoch = 0
    if resume:
        ckpt_path = runs_store.latest_checkpoint(run_id)
        if ckpt_path is not None:
            ckpt = torch.load(ckpt_path, map_location=device)
            module.load_state_dict(ckpt["model"])
            optimizer.load_state_dict(ckpt["optimizer"])
            start_epoch = int(ckpt["epoch"])

    epochs = int(config.get("epochs", 20))
    batch_size = int(config.get("batch_size", 32))
    runs_store.append_log(run_id, f"device={device} resume_from={start_epoch}")

    for epoch in range(start_epoch + 1, epochs + 1):
        if runs_store.pause_requested(run_id):
            runs_store.append_log(run_id, f"paused before epoch {epoch}")
            return "paused"

        module.train()
        total = 0.0
        nb = 0
        for xb, yb in _loader(data["X_train"], y_train, batch_size, device):
            optimizer.zero_grad()
            out = module(xb)
            loss = loss_fn(out, yb)
            loss.backward()
            optimizer.step()
            total += float(loss.item())
            nb += 1
        train_loss = total / max(nb, 1)

        module.eval()
        with torch.no_grad():
            xv = torch.tensor(data["X_val"], dtype=torch.float32, device=device)
            vout = module(xv)
            if task == "classification":
                yv = torch.tensor(y_val, device=device)
                val_loss = float(loss_fn(vout, yv).item())
                val_acc = float((vout.argmax(1) == yv).float().mean().item())
            else:
                yv = torch.tensor(y_val, device=device)
                val_loss = float(loss_fn(vout, yv).item())
                val_acc = 0.0

        point = {
            "epoch": epoch,
            "train_loss": round(train_loss, 6),
            "val_loss": round(val_loss, 6),
            "val_acc": round(val_acc, 6),
            "t": time.time(),
        }
        runs_store.append_metric(run_id, point)
        runs_store.append_log(
            run_id, f"epoch {epoch}/{epochs} train_loss={train_loss:.4f} val_acc={val_acc:.4f}"
        )
        torch.save(
            {"model": module.state_dict(), "optimizer": optimizer.state_dict(), "epoch": epoch},
            runs_store.run_dir(run_id) / "checkpoints" / f"epoch_{epoch:04d}.pt",
        )

    runs_store.append_log(run_id, "training complete")
    return "completed"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--spec", required=True, help="path to a JSON spec file")
    ap.add_argument("--resume", action="store_true")
    args = ap.parse_args()
    spec = json.loads(open(args.spec, encoding="utf-8").read())
    status = run_training(
        spec["run_id"], spec["prep_id"], spec["nodes"], spec["edges"],
        spec["task"], spec["config"], resume=args.resume,
    )
    print(f"STATUS={status}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run → PASS** (`pytest tests/test_training_smoke.py -v`; CPU, a few seconds), then **Commit**

```bash
git add backend/app/training/train_entry.py backend/tests/test_training_smoke.py
git commit -m "feat(backend): add resumable training entrypoint (metrics, checkpoints, pause)"
```

---

## Task 6: Job manager (subprocess lifecycle)

**Files:** Create `app/training/job_manager.py`; Test `tests/test_job_manager.py`.

- [ ] **Step 1: Failing test `tests/test_job_manager.py`**

```python
import time

from app.training import job_manager, runs_store


def test_spawn_and_complete(monkeypatch, tmp_path):
    monkeypatch.setenv("MODELROOM_WORKSPACE", str(tmp_path))
    # tiny prepared data + graph
    import numpy as np
    from app.preprocessing import store as prep_store

    rng = np.random.default_rng(0)
    prep_store.save_prepared(
        2,
        {
            "X_train": rng.standard_normal((20, 3)).astype("float32"),
            "y_train": rng.integers(0, 2, 20),
            "X_val": rng.standard_normal((6, 3)).astype("float32"),
            "y_val": rng.integers(0, 2, 6),
            "X_test": rng.standard_normal((6, 3)).astype("float32"),
            "y_test": rng.integers(0, 2, 6),
        },
    )
    spec = {
        "run_id": 9,
        "prep_id": 2,
        "task": "classification",
        "nodes": [
            {"id": "in", "type": "input", "params": {"features": 3}},
            {"id": "out", "type": "output", "params": {"classes": 2}},
        ],
        "edges": [{"source": "in", "target": "out"}],
        "config": {"optimizer": "adam", "lr": 0.01, "epochs": 2, "batch_size": 8, "devices": ["cpu"]},
    }
    job_manager.start(9, spec)
    for _ in range(120):
        if not job_manager.is_running(9):
            break
        time.sleep(0.5)
    assert not job_manager.is_running(9)
    assert len(runs_store.read_metrics(9)) == 2
```

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Write `app/training/job_manager.py`**

```python
import json
import subprocess
import sys

from app.training import runs_store

_procs: dict[int, subprocess.Popen] = {}


def _spec_path(run_id: int):
    return runs_store.run_dir(run_id) / "spec.json"


def start(run_id: int, spec: dict, resume: bool = False) -> None:
    runs_store.clear_pause(run_id)
    _spec_path(run_id).write_text(json.dumps(spec), encoding="utf-8")
    args = [sys.executable, "-m", "app.training.train_entry", "--spec", str(_spec_path(run_id))]
    if resume:
        args.append("--resume")
    log = runs_store.log_path(run_id).open("a", encoding="utf-8")
    _procs[run_id] = subprocess.Popen(args, stdout=log, stderr=subprocess.STDOUT)


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
```

- [ ] **Step 4: Run → PASS** (subprocess runs `app.training.train_entry`; needs CWD=backend so `app` imports — the test runs under pytest from `backend/` so `sys.executable -m app.training.train_entry` resolves), then **Commit**

```bash
git add backend/app/training/job_manager.py backend/tests/test_job_manager.py
git commit -m "feat(backend): add subprocess job manager (start/pause/stop)"
```

---

## Task 7: Runs API + WebSocket

**Files:** Create `app/routers/runs.py`; Modify `app/main.py`; Test `tests/test_runs_api.py`.

Builds a run from a model (its graph + dataset's `Preparation`). Endpoints:
`POST /api/runs` (create+start), `GET /api/projects/{pid}/runs`, `GET /api/runs/{id}` (status + metrics + log tail), `POST /api/runs/{id}/pause|resume|stop`, `WS /api/runs/{id}/stream`.

- [ ] **Step 1: Failing test `tests/test_runs_api.py`**

```python
import io
import json
import time


def _prepared_model(client, monkeypatch, tmp_path):
    monkeypatch.setenv("MODELROOM_WORKSPACE", str(tmp_path))
    pid = client.post("/api/projects", json={"name": "P"}).json()["id"]
    rows = "a,b,label\n" + "\n".join(f"{i},{i*2},{i%2}" for i in range(40))
    did = client.post(
        "/api/datasets", files={"file": ("d.csv", io.BytesIO(rows.encode()), "text/csv")}
    ).json()["id"]
    client.put(
        f"/api/datasets/{did}/pipeline",
        json={"target": "label", "steps": [{"type": "standardize", "params": {}}],
              "train_ratio": 0.7, "val_ratio": 0.15, "seed": 1},
    )
    client.post(f"/api/datasets/{did}/pipeline/apply")
    graph = {
        "nodes": [
            {"id": "in", "type": "input", "params": {"features": 2}},
            {"id": "out", "type": "output", "params": {"classes": 2}},
        ],
        "edges": [{"source": "in", "target": "out"}],
    }
    mid = client.post(
        f"/api/projects/{pid}/models", json={"name": "m", "dataset_id": did, "graph": graph}
    ).json()["id"]
    return pid, mid


def test_create_run_and_complete(client, monkeypatch, tmp_path):
    pid, mid = _prepared_model(client, monkeypatch, tmp_path)
    run = client.post(
        "/api/runs",
        json={"model_id": mid, "config": {"epochs": 2, "batch_size": 8, "devices": ["cpu"]}},
    ).json()
    rid = run["id"]
    for _ in range(120):
        got = client.get(f"/api/runs/{rid}").json()
        if got["status"] in ("completed", "failed"):
            break
        time.sleep(0.5)
    final = client.get(f"/api/runs/{rid}").json()
    assert final["status"] == "completed"
    assert len(final["metrics"]) == 2
```

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Write `app/routers/runs.py`**

```python
import json

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlmodel import Session, select

from app.db import get_session
from app.models import ModelDef, Preparation, Run
from app.schemas import RunCreate
from app.training import job_manager, runs_store

router = APIRouter(prefix="/api", tags=["runs"])


def _sync_status(run: Run, session: Session) -> Run:
    if run.status in ("running", "paused") and run.id is not None:
        if not job_manager.is_running(run.id):
            code = job_manager.exit_code(run.id)
            if runs_store.pause_requested(run.id):
                run.status = "paused"
            elif code == 0:
                run.status = "completed"
            elif code is None:
                pass
            else:
                run.status = "failed"
            metrics = runs_store.read_metrics(run.id)
            if metrics:
                run.last_epoch = metrics[-1]["epoch"]
            session.add(run)
            session.commit()
            session.refresh(run)
    return run


def _spec_for(run: Run, session: Session) -> dict:
    model = session.get(ModelDef, run.model_id)
    graph = json.loads(model.graph_json)
    prep = session.exec(
        select(Preparation).where(Preparation.dataset_id == model.dataset_id)
    ).first()
    if prep is None:
        raise HTTPException(status_code=400, detail="Dataset has no applied pipeline")
    summary = json.loads(prep.summary_json)
    return {
        "run_id": run.id,
        "prep_id": prep.id,
        "task": summary.get("task", "classification"),
        "nodes": graph.get("nodes", []),
        "edges": graph.get("edges", []),
        "config": json.loads(run.config_json),
    }


@router.post("/runs")
def create_run(body: RunCreate, session: Session = Depends(get_session)):
    model = session.get(ModelDef, body.model_id)
    if model is None:
        raise HTTPException(status_code=404, detail="Model not found")
    run = Run(
        project_id=model.project_id,
        model_id=model.id,
        status="running",
        config_json=json.dumps(body.config.model_dump()),
    )
    session.add(run)
    session.commit()
    session.refresh(run)
    job_manager.start(run.id, _spec_for(run, session))
    return {"id": run.id, "status": run.status}


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
    return {**_read(run), "metrics": runs_store.read_metrics(run_id), "log": runs_store.read_log(run_id)}


def _read(run: Run) -> dict:
    return {
        "id": run.id,
        "project_id": run.project_id,
        "model_id": run.model_id,
        "status": run.status,
        "last_epoch": run.last_epoch,
        "config": json.loads(run.config_json),
    }


@router.post("/runs/{run_id}/pause")
def pause_run(run_id: int, session: Session = Depends(get_session)):
    run = session.get(Run, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    job_manager.pause(run_id)
    return {"ok": True}


@router.post("/runs/{run_id}/resume")
def resume_run(run_id: int, session: Session = Depends(get_session)):
    run = session.get(Run, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    runs_store.clear_pause(run_id)
    run.status = "running"
    session.add(run)
    session.commit()
    job_manager.start(run_id, _spec_for(run, session), resume=True)
    return {"ok": True}


@router.post("/runs/{run_id}/stop")
def stop_run(run_id: int, session: Session = Depends(get_session)):
    run = session.get(Run, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    job_manager.stop(run_id)
    run.status = "stopped"
    session.add(run)
    session.commit()
    return {"ok": True}


@router.websocket("/runs/{run_id}/stream")
async def stream(websocket: WebSocket, run_id: int):
    import asyncio

    await websocket.accept()
    sent = 0
    try:
        while True:
            metrics = runs_store.read_metrics(run_id)
            if len(metrics) > sent:
                for m in metrics[sent:]:
                    await websocket.send_json({"type": "metric", "data": m})
                sent = len(metrics)
            if not job_manager.is_running(run_id):
                await websocket.send_json({"type": "done"})
                break
            await asyncio.sleep(0.5)
    except WebSocketDisconnect:
        pass
```

- [ ] **Step 4: Wire in `app/main.py`** — `from app.routers import ... runs ...` and `app.include_router(runs.router)`.

- [ ] **Step 5: Run → PASS** (`pytest tests/test_runs_api.py -v`), full suite, then **Commit**

```bash
git add backend/app/routers/runs.py backend/app/main.py backend/tests/test_runs_api.py
git commit -m "feat(backend): runs API (create/list/get/pause/resume/stop) + metrics WebSocket"
```

---

## Task 8: Frontend run types + client + stream hook

**Files:** Modify `src/lib/types.ts`, `src/api/client.ts`; Create `src/lib/useRunStream.ts`.

- [ ] **Step 1: Append types to `src/lib/types.ts`**

```ts
export interface RunConfig {
  optimizer: string;
  lr: number;
  epochs: number;
  batch_size: number;
  devices: string[];
}

export interface RunMetricPoint {
  epoch: number;
  train_loss: number;
  val_loss: number;
  val_acc: number;
}

export interface Run {
  id: number;
  project_id: number;
  model_id: number;
  status: "queued" | "running" | "paused" | "completed" | "failed" | "stopped";
  last_epoch: number;
  config: RunConfig;
  metrics?: RunMetricPoint[];
  log?: string;
}
```

- [ ] **Step 2: Append endpoints to `src/api/client.ts`**

```ts
  createRun: (model_id: number, config: Partial<RunConfig>) =>
    request<{ id: number; status: string }>(`/runs`, {
      method: "POST",
      body: JSON.stringify({ model_id, config }),
    }),
  listRuns: (projectId: number) => request<Run[]>(`/projects/${projectId}/runs`),
  getRun: (runId: number) => request<Run>(`/runs/${runId}`),
  pauseRun: (runId: number) => request<{ ok: boolean }>(`/runs/${runId}/pause`, { method: "POST" }),
  resumeRun: (runId: number) => request<{ ok: boolean }>(`/runs/${runId}/resume`, { method: "POST" }),
  stopRun: (runId: number) => request<{ ok: boolean }>(`/runs/${runId}/stop`, { method: "POST" }),
```

(Import `Run`, `RunConfig` types.)

- [ ] **Step 3: Create `src/lib/useRunStream.ts`** — opens `ws://<host>/api/runs/<id>/stream`, seeds from `getRun` (replay), appends live points, reconnects once on drop.

```ts
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { RunMetricPoint } from "./types";

export function useRunStream(runId: number, active: boolean) {
  const [metrics, setMetrics] = useState<RunMetricPoint[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let cancelled = false;
    api.getRun(runId).then((r) => {
      if (!cancelled) setMetrics(r.metrics ?? []);
    });
    if (active) {
      ws = new WebSocket(`ws://${location.host}/api/runs/${runId}/stream`);
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === "metric") setMetrics((m) => [...m, msg.data]);
        if (msg.type === "done") setDone(true);
      };
    }
    return () => {
      cancelled = true;
      ws?.close();
    };
  }, [runId, active]);

  return { metrics, done };
}
```

Note: Vite must proxy WebSocket — set `proxy: { "/api": { target: "http://127.0.0.1:8000", ws: true } }` in `vite.config.ts`.

- [ ] **Step 4: Update `vite.config.ts` proxy to `{ target: "http://127.0.0.1:8000", ws: true }`**, build, **Commit**

```bash
git add frontend/src/lib/types.ts frontend/src/api/client.ts frontend/src/lib/useRunStream.ts frontend/vite.config.ts
git commit -m "feat(frontend): run types, client, and WebSocket stream hook"
```

---

## Task 9: Train panel + live run view

**Files:** Create `src/components/training/TrainPanel.tsx`, `src/components/training/RunView.tsx`; Modify `src/pages/ModelBuilder.tsx`.

- [ ] **Step 1:** `TrainPanel` — reads selected devices from `localStorage["modelroom.devices"]`; fields optimizer/lr/epochs/batch_size; "Start training" → `api.createRun(model.id, config)` → calls `onStarted(runId)`. Render this from the builder header ("Train" button opens the panel; requires the model's dataset to have an applied pipeline — surface the 400 error if not).

- [ ] **Step 2:** `RunView` — uses `useRunStream(runId, active)`; two Recharts line charts (train/val loss; val acc), a live console (`<pre>` of `getRun().log`, polled), and controls Pause/Resume/Stop wired to the client; status badge.

- [ ] **Step 3:** Build + a Vitest render test for `RunView` (mock `useRunStream` + client) asserting the charts/console mount and Pause calls `api.pauseRun`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/training frontend/src/pages/ModelBuilder.tsx
git commit -m "feat(frontend): train panel + live run view (charts, console, controls)"
```

---

## Task 10: Jobs page + run comparison + model versioning

**Files:** Create `src/pages/JobsPage.tsx`, `src/components/training/RunCompare.tsx`; Modify `src/App.tsx` (Jobs route), `src/pages/ModelsPage.tsx` (Duplicate).

- [ ] **Step 1:** `JobsPage` — project dropdown (reuse pattern) → `api.listRuns(projectId)` table (status, model, epochs, best val_acc from summary). Select rows → "Compare" opens `RunCompare`. Empty state via `EmptyState`.

- [ ] **Step 2:** `RunCompare` — fetch each selected run's metrics; overlay val_acc and val_loss curves (Recharts, one line per run) + a table of final/best metrics with deltas.

- [ ] **Step 3: Model versioning** — add a "Duplicate" button on model cards in `ModelsPage` that creates a new model (`api.createModel`) with a `" v2"`-suffixed name and the same graph + dataset (fetch source graph via `getModel`, pass to a new create that accepts a graph — extend `createModel` to optionally take a graph, or add `duplicateModel`). This lets the user tweak a copy and compare runs across versions.

- [ ] **Step 4:** Route "Jobs" in `App.tsx`. Build + Vitest test for `JobsPage` (mock client) asserting it lists runs / shows empty state.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/JobsPage.tsx frontend/src/components/training/RunCompare.tsx frontend/src/App.tsx frontend/src/pages/ModelsPage.tsx
git commit -m "feat(frontend): Jobs page, run comparison, and model versioning"
```

---

## Task 11: End-to-end verification

- [ ] **Step 1:** Start backend (isolated workspace) + frontend.
- [ ] **Step 2: Extend `e2e/smoke.spec.ts`** — full path: upload CSV → apply pipeline → create model → Train (epochs=2, cpu) → wait for completion → loss chart + "completed" visible → screenshot. (Use CPU + tiny epochs for speed.)
- [ ] **Step 3:** `npx playwright test` → all pass; inspect `e2e/screens/training.png`.
- [ ] **Step 4:** Stop servers, clean, run `pytest -q` + `npm test`.
- [ ] **Step 5: Commit** `chore: phase 5 training end-to-end verified`.

---

## Self-Review Notes (against the spec)

- **Training & compute, device selection:** Tasks 5–7 (entrypoint picks `cuda:N` if available else cpu; devices come from the status-bar selector via `localStorage`, Task 9). Multi-GPU `DataParallel` is a follow-up; single-device path is the v0.1 contract.
- **Checkpointing + pause/resume:** Task 5 (checkpoint each epoch; pause = cooperative flag → exit; resume loads latest checkpoint) + Task 7 control endpoints + Task 9 controls. Crash/OOM → run marked `failed` with log (`_sync_status`).
- **Live metrics over WebSocket:** Task 7 WS + Task 8 hook + Task 9 charts; replay via `getRun().metrics` on (re)connect.
- **Model save/load + versioning:** load/save from Phase 4; versioning via Duplicate (Task 10).
- **Run comparison + project stats:** Task 10 RunCompare; project-detail "best model/accuracy/GPU hours" can read run summaries (follow-up wiring once runs exist).
- **CPU is the CI contract; CUDA gated behind hardware** — smoke tests + E2E use CPU + tiny epochs.
- **Type consistency:** `Run`/`RunConfig`/`RunMetricPoint` defined in Task 8, used in 9–10; backend `_read`/metrics keys (`train_loss`,`val_loss`,`val_acc`,`epoch`,`status`,`last_epoch`) match the frontend types.
