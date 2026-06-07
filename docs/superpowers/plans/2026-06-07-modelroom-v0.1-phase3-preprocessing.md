# ModelRoom v0.1 — Phase 3: Preprocessing Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user build an ordered, reproducible preprocessing pipeline on a dataset (clean → encode/scale → pick target → split), apply it to produce train/val/test arrays, and see the resulting summary and target distribution — all leakage-safe (transformers fit on train only).

**Architecture:** A pure, unit-tested `app/preprocessing/pipeline.py` turns (DataFrame, ordered steps, target, split) into fitted state + train/val/test arrays + a summary; sklearn transformers are fit on the train split only and reused for val/test. A `Preparation` row stores the steps/target/summary; the arrays are persisted as an `.npz` under the workspace. Thin endpoints save the pipeline and apply it. The frontend adds a "Data Processing" panel to the Datasets page (matching `design_idea/dataset_preprocessing_light`) plus a target-distribution chart.

**Tech Stack:** Adds `scikit-learn` (backend). Reuses Phase 1–2 stack and the Playwright E2E harness.

**Spec reference:** `docs/superpowers/specs/2026-06-07-modelroom-foundation-mlp-design.md` — Backend → Preprocessing; Visualizations → target/class distribution `[v0.1]`, before/after `[v0.1]`.

**Builds on:** Phase 2 (`Dataset`, `store.load_df`, datasets API, Datasets page). Branch off Phase 2 HEAD.

---

## Design decisions (ML correctness)

- **Leakage-safe:** drop-nulls/impute fit statistics, scalers, and encoders are all fit on the **train split only**, then applied to val/test.
- **Step order:** cleaning steps (`drop_nulls`, `impute`) run on the full frame first (row-level, no fitted leakage for drop; impute uses train stats), then split, then column transforms (`standardize`/`minmax`/`one_hot`) fit on train.
- **Target:** chosen by column name; classification if non-numeric or low-cardinality integer, else regression. v0.1 label-encodes a classification target to class indices.
- **Split:** deterministic shuffle with a fixed seed; ratios default 0.7/0.15/0.15.
- **Output contract** (consumed by Phase 4 training): `X_train,y_train,X_val,y_val,X_test,y_test` float32 arrays + `feature_names`, `n_features`, `task` (`classification|regression`), `n_classes`, `classes`.

---

## File Structure

**Backend**
- Modify `backend/pyproject.toml` — add scikit-learn.
- Modify `backend/app/models.py` — add `Preparation`.
- Modify `backend/app/schemas.py` — add `PipelineSpec`, `PreparationSummary`.
- Create `backend/app/preprocessing/__init__.py`
- Create `backend/app/preprocessing/pipeline.py` — pure prepare().
- Create `backend/app/preprocessing/store.py` — save/load prepared `.npz`.
- Create `backend/app/routers/preprocessing.py` — endpoints.
- Modify `backend/app/main.py` — include router.
- Tests: `test_pipeline.py`, `test_preprocessing_api.py`.

**Frontend**
- Modify `frontend/src/lib/types.ts` — pipeline/preparation types.
- Modify `frontend/src/api/client.ts` — pipeline endpoints.
- Create `frontend/src/components/datasets/ProcessingPanel.tsx` — step builder + target + apply.
- Modify `frontend/src/pages/DatasetsPage.tsx` — mount the panel + target distribution chart.
- Tests: `ProcessingPanel.test.tsx`; extend `e2e/smoke.spec.ts`.

---

## Task 1: Backend deps + Preparation model + schemas

**Files:**
- Modify: `backend/pyproject.toml`, `backend/app/models.py`, `backend/app/schemas.py`
- Test: `backend/tests/test_models.py` (extend)

- [ ] **Step 1: Add scikit-learn to `backend/pyproject.toml`** (append to `dependencies`)

```toml
    "scikit-learn>=1.4",
```

- [ ] **Step 2: Install**

Run (from `backend/`): `.venv/Scripts/python -m pip install -q -e ".[dev]"`
Expected: scikit-learn installs.

- [ ] **Step 3: Write the failing test (append to `backend/tests/test_models.py`)**

```python
def test_preparation_defaults():
    from app.models import Preparation

    p = Preparation(dataset_id=1, target="y")
    assert p.dataset_id == 1
    assert p.target == "y"
    assert p.steps_json == "[]"
```

- [ ] **Step 4: Run to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_models.py::test_preparation_defaults -v`
Expected: FAIL — cannot import `Preparation`.

- [ ] **Step 5: Add `Preparation` to `backend/app/models.py`** (append)

```python
class Preparation(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    dataset_id: int = Field(foreign_key="dataset.id", index=True)
    target: str
    steps_json: str = "[]"
    summary_json: str = "{}"
    created_at: datetime = Field(default_factory=_now)
```

- [ ] **Step 6: Add schemas to `backend/app/schemas.py`** (append)

```python
class PipelineStep(BaseModel):
    type: str
    params: dict = {}


class PipelineSpec(BaseModel):
    target: str
    steps: list[PipelineStep] = []
    train_ratio: float = 0.7
    val_ratio: float = 0.15
    seed: int = 42
```

- [ ] **Step 7: Run to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_models.py -v`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/pyproject.toml backend/app/models.py backend/app/schemas.py backend/tests/test_models.py
git commit -m "feat(backend): add Preparation model, pipeline schemas, sklearn dep"
```

---

## Task 2: Pure preprocessing pipeline

**Files:**
- Create: `backend/app/preprocessing/__init__.py`, `backend/app/preprocessing/pipeline.py`
- Test: `backend/tests/test_pipeline.py`

- [ ] **Step 1: Create `backend/app/preprocessing/__init__.py`** (empty file)

```python
```

- [ ] **Step 2: Write the failing test `backend/tests/test_pipeline.py`**

```python
import numpy as np
import pandas as pd

from app.preprocessing import pipeline


def _df():
    # 20 rows so splits are non-empty
    rng = np.random.default_rng(0)
    return pd.DataFrame(
        {
            "age": rng.integers(18, 70, size=20).astype(float),
            "city": rng.choice(["NY", "LA", "SF"], size=20),
            "label": rng.choice(["yes", "no"], size=20),
        }
    )


def test_prepare_classification_shapes_and_summary():
    spec = {
        "target": "label",
        "steps": [{"type": "standardize", "params": {}}, {"type": "one_hot", "params": {}}],
        "train_ratio": 0.7,
        "val_ratio": 0.15,
        "seed": 42,
    }
    out = pipeline.prepare(_df(), spec)

    assert out["task"] == "classification"
    assert out["n_classes"] == 2
    assert set(out["classes"]) == {"no", "yes"}
    # one-hot of 3-city + standardized age => 1 + 3 features (drop none)
    assert out["n_features"] == out["X_train"].shape[1]
    assert out["X_train"].dtype == np.float32
    # splits sum to 20
    assert (
        out["X_train"].shape[0] + out["X_val"].shape[0] + out["X_test"].shape[0] == 20
    )
    # y values are class indices
    assert set(np.unique(out["y_train"])).issubset({0, 1})


def test_standardize_fits_on_train_only():
    # train mean used to transform; transformed train age has ~0 mean
    spec = {"target": "label", "steps": [{"type": "standardize", "params": {}}],
            "train_ratio": 0.7, "val_ratio": 0.15, "seed": 1}
    out = pipeline.prepare(_df(), spec)
    age_idx = out["feature_names"].index("age")
    assert abs(float(out["X_train"][:, age_idx].mean())) < 1e-6


def test_drop_nulls_reduces_rows():
    df = _df()
    df.loc[0, "age"] = np.nan
    spec = {"target": "label", "steps": [{"type": "drop_nulls", "params": {}}],
            "train_ratio": 0.7, "val_ratio": 0.15, "seed": 1}
    out = pipeline.prepare(df, spec)
    total = out["X_train"].shape[0] + out["X_val"].shape[0] + out["X_test"].shape[0]
    assert total == 19


def test_regression_target():
    df = pd.DataFrame({"x": np.arange(20.0), "y": np.arange(20.0) * 2})
    spec = {"target": "y", "steps": [], "train_ratio": 0.7, "val_ratio": 0.15, "seed": 0}
    out = pipeline.prepare(df, spec)
    assert out["task"] == "regression"
    assert out["n_classes"] == 0
```

- [ ] **Step 3: Run to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_pipeline.py -v`
Expected: FAIL — no module `app.preprocessing.pipeline`.

- [ ] **Step 4: Write `backend/app/preprocessing/pipeline.py`**

```python
import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler, OneHotEncoder, StandardScaler


def _split_indices(n: int, train_ratio: float, val_ratio: float, seed: int):
    rng = np.random.default_rng(seed)
    idx = rng.permutation(n)
    n_train = int(n * train_ratio)
    n_val = int(n * val_ratio)
    return idx[:n_train], idx[n_train : n_train + n_val], idx[n_train + n_val :]


def _is_classification(y: pd.Series) -> bool:
    if not pd.api.types.is_numeric_dtype(y):
        return True
    return y.nunique(dropna=True) <= max(2, int(0.05 * len(y)))


def prepare(df: pd.DataFrame, spec: dict) -> dict:
    df = df.copy()
    steps = spec.get("steps", [])
    types = [s["type"] for s in steps]
    target = spec["target"]

    if "drop_nulls" in types:
        df = df.dropna().reset_index(drop=True)

    y_raw = df[target]
    X = df.drop(columns=[target])
    num_cols = [c for c in X.columns if pd.api.types.is_numeric_dtype(X[c])]
    cat_cols = [c for c in X.columns if c not in num_cols]

    if "impute" in types:
        for c in num_cols:
            X[c] = X[c].fillna(X[c].mean())
        for c in cat_cols:
            mode = X[c].mode(dropna=True)
            X[c] = X[c].fillna(mode.iloc[0] if len(mode) else "missing")

    tr, va, te = _split_indices(
        len(df), spec.get("train_ratio", 0.7), spec.get("val_ratio", 0.15),
        spec.get("seed", 42),
    )

    scaler = None
    if "standardize" in types:
        scaler = StandardScaler()
    elif "minmax" in types:
        scaler = MinMaxScaler()

    feature_names: list[str] = list(num_cols)
    num_train = X[num_cols].to_numpy(dtype=np.float64)[tr] if num_cols else None
    if scaler is not None and num_cols:
        scaler.fit(num_train)

    def _num_block(rows):
        if not num_cols:
            return np.empty((len(rows), 0))
        block = X[num_cols].to_numpy(dtype=np.float64)[rows]
        return scaler.transform(block) if scaler is not None else block

    encoder = None
    if "one_hot" in types and cat_cols:
        encoder = OneHotEncoder(handle_unknown="ignore", sparse_output=False)
        encoder.fit(X[cat_cols].iloc[tr])
        feature_names = feature_names + list(encoder.get_feature_names_out(cat_cols))

    def _cat_block(rows):
        if encoder is None or not cat_cols:
            return np.empty((len(rows), 0))
        return encoder.transform(X[cat_cols].iloc[rows])

    def _features(rows):
        return np.hstack([_num_block(rows), _cat_block(rows)]).astype(np.float32)

    task = "classification" if _is_classification(y_raw) else "regression"
    if task == "classification":
        classes = sorted(map(str, pd.unique(y_raw.astype(str))))
        class_to_idx = {c: i for i, c in enumerate(classes)}
        y_all = y_raw.astype(str).map(class_to_idx).to_numpy()
        n_classes = len(classes)
    else:
        classes = []
        y_all = y_raw.to_numpy(dtype=np.float32)
        n_classes = 0

    def _y(rows):
        return y_all[rows]

    return {
        "task": task,
        "classes": classes,
        "n_classes": n_classes,
        "feature_names": feature_names,
        "n_features": len(feature_names),
        "X_train": _features(tr), "y_train": _y(tr),
        "X_val": _features(va), "y_val": _y(va),
        "X_test": _features(te), "y_test": _y(te),
    }


def summarize(out: dict) -> dict:
    summary = {
        "task": out["task"],
        "n_features": out["n_features"],
        "n_classes": out["n_classes"],
        "classes": out["classes"],
        "splits": {
            "train": int(out["X_train"].shape[0]),
            "val": int(out["X_val"].shape[0]),
            "test": int(out["X_test"].shape[0]),
        },
    }
    if out["task"] == "classification":
        idx, counts = np.unique(out["y_train"], return_counts=True)
        dist = {out["classes"][int(i)]: int(c) for i, c in zip(idx, counts)}
        summary["target_distribution"] = dist
    return summary
```

- [ ] **Step 5: Run to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_pipeline.py -v`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/preprocessing/__init__.py backend/app/preprocessing/pipeline.py backend/tests/test_pipeline.py
git commit -m "feat(backend): add pure leakage-safe preprocessing pipeline"
```

---

## Task 3: Prepared-array store

**Files:**
- Create: `backend/app/preprocessing/store.py`
- Test: `backend/tests/test_preprocessing_store.py`

- [ ] **Step 1: Write the failing test `backend/tests/test_preprocessing_store.py`**

```python
import numpy as np


def test_save_and_load_prepared(monkeypatch, tmp_path):
    monkeypatch.setenv("MODELROOM_WORKSPACE", str(tmp_path))
    from app.preprocessing import store

    arrays = {
        "X_train": np.ones((3, 2), dtype="float32"),
        "y_train": np.array([0, 1, 0]),
    }
    store.save_prepared(5, arrays)
    loaded = store.load_prepared(5)
    assert loaded["X_train"].shape == (3, 2)
    assert store.prepared_path(5).exists()
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_preprocessing_store.py -v`
Expected: FAIL — no module `app.preprocessing.store`.

- [ ] **Step 3: Write `backend/app/preprocessing/store.py`**

```python
from pathlib import Path

import numpy as np

from app.config import get_settings

ARRAY_KEYS = ["X_train", "y_train", "X_val", "y_val", "X_test", "y_test"]


def prepared_path(preparation_id: int) -> Path:
    base = get_settings().workspace_dir / "prepared"
    base.mkdir(parents=True, exist_ok=True)
    return base / f"{preparation_id}.npz"


def save_prepared(preparation_id: int, arrays: dict) -> None:
    np.savez(prepared_path(preparation_id), **{k: v for k, v in arrays.items() if k in ARRAY_KEYS})


def load_prepared(preparation_id: int) -> dict:
    with np.load(prepared_path(preparation_id), allow_pickle=False) as data:
        return {k: data[k] for k in data.files}
```

- [ ] **Step 4: Run to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_preprocessing_store.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/preprocessing/store.py backend/tests/test_preprocessing_store.py
git commit -m "feat(backend): add prepared-array npz store"
```

---

## Task 4: Preprocessing API router

**Files:**
- Create: `backend/app/routers/preprocessing.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_preprocessing_api.py`

- [ ] **Step 1: Write the failing test `backend/tests/test_preprocessing_api.py`**

```python
import io


def _make_dataset(client, monkeypatch, tmp_path):
    monkeypatch.setenv("MODELROOM_WORKSPACE", str(tmp_path))
    pid = client.post("/api/projects", json={"name": "P"}).json()["id"]
    rows = "age,city,label\n" + "\n".join(
        f"{20 + i},{'NY' if i % 2 else 'LA'},{'yes' if i % 3 else 'no'}" for i in range(20)
    )
    res = client.post(
        f"/api/projects/{pid}/datasets",
        files={"file": ("d.csv", io.BytesIO(rows.encode()), "text/csv")},
    )
    return res.json()["id"]


def test_save_and_apply_pipeline(client, monkeypatch, tmp_path):
    did = _make_dataset(client, monkeypatch, tmp_path)

    spec = {
        "target": "label",
        "steps": [{"type": "standardize", "params": {}}, {"type": "one_hot", "params": {}}],
        "train_ratio": 0.7,
        "val_ratio": 0.15,
        "seed": 42,
    }
    save = client.put(f"/api/datasets/{did}/pipeline", json=spec)
    assert save.status_code == 200

    applied = client.post(f"/api/datasets/{did}/pipeline/apply").json()
    assert applied["task"] == "classification"
    assert applied["splits"]["train"] + applied["splits"]["val"] + applied["splits"]["test"] == 20
    assert "target_distribution" in applied

    got = client.get(f"/api/datasets/{did}/pipeline").json()
    assert got["target"] == "label"
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_preprocessing_api.py -v`
Expected: FAIL — routes missing.

- [ ] **Step 3: Write `backend/app/routers/preprocessing.py`**

```python
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
```

- [ ] **Step 4: Wire in `backend/app/main.py`**

Change `from app.routers import datasets, projects` to:

```python
from app.routers import datasets, preprocessing, projects
```

Add after `app.include_router(datasets.router)`:

```python
    app.include_router(preprocessing.router)
```

- [ ] **Step 5: Run to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_preprocessing_api.py -v`
Expected: PASS.

- [ ] **Step 6: Run the full backend suite**

Run: `.venv/Scripts/python -m pytest -q`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/preprocessing.py backend/app/main.py backend/tests/test_preprocessing_api.py
git commit -m "feat(backend): add preprocessing pipeline API (save/get/apply)"
```

---

## Task 5: Frontend types + API client

**Files:**
- Modify: `frontend/src/lib/types.ts`, `frontend/src/api/client.ts`

- [ ] **Step 1: Append types to `frontend/src/lib/types.ts`**

```ts
export interface PipelineStep {
  type: string;
  params: Record<string, unknown>;
}

export interface PipelineSpec {
  target: string;
  steps: PipelineStep[];
  train_ratio: number;
  val_ratio: number;
  seed: number;
}

export interface PreparationSummary {
  task: "classification" | "regression";
  n_features: number;
  n_classes: number;
  classes: string[];
  splits: { train: number; val: number; test: number };
  target_distribution?: Record<string, number>;
}
```

- [ ] **Step 2: Append endpoints to the `api` object in `frontend/src/api/client.ts`**

First extend the type import to include the new types:

```ts
import type {
  Project,
  Dataset,
  SchemaColumn,
  Preview,
  Histogram,
  Correlation,
  PipelineSpec,
  PreparationSummary,
} from "../lib/types";
```

Then add before the closing brace of `api`:

```ts
  savePipeline: (datasetId: number, spec: PipelineSpec) =>
    request<{ id: number; target: string }>(`/datasets/${datasetId}/pipeline`, {
      method: "PUT",
      body: JSON.stringify(spec),
    }),
  applyPipeline: (datasetId: number) =>
    request<PreparationSummary>(`/datasets/${datasetId}/pipeline/apply`, {
      method: "POST",
    }),
```

- [ ] **Step 3: Verify the build compiles**

Run (from `frontend/`): `npm run build`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/types.ts frontend/src/api/client.ts
git commit -m "feat(frontend): add preprocessing types and API client"
```

---

## Task 6: Processing panel component

**Files:**
- Create: `frontend/src/components/datasets/ProcessingPanel.tsx`
- Test: `frontend/src/components/datasets/__tests__/ProcessingPanel.test.tsx`

- [ ] **Step 1: Write the failing test `frontend/src/components/datasets/__tests__/ProcessingPanel.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProcessingPanel } from "../ProcessingPanel";
import { api } from "../../../api/client";

vi.mock("../../../api/client", () => ({
  api: {
    savePipeline: vi.fn().mockResolvedValue({ id: 1, target: "label" }),
    applyPipeline: vi.fn().mockResolvedValue({
      task: "classification",
      n_features: 4,
      n_classes: 2,
      classes: ["no", "yes"],
      splits: { train: 14, val: 3, test: 3 },
      target_distribution: { no: 7, yes: 7 },
    }),
  },
}));

function setup() {
  const qc = new QueryClient();
  render(
    <QueryClientProvider client={qc}>
      <ProcessingPanel
        datasetId={5}
        columns={["age", "city", "label"]}
      />
    </QueryClientProvider>
  );
}

test("adds a step and applies the pipeline", async () => {
  setup();
  await userEvent.selectOptions(screen.getByLabelText("Target"), "label");
  await userEvent.selectOptions(screen.getByLabelText("Add step"), "standardize");
  expect(screen.getByText("standardize")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Apply Pipeline" }));
  expect(api.savePipeline).toHaveBeenCalled();
  expect(api.applyPipeline).toHaveBeenCalledWith(5);
  expect(await screen.findByText(/14 train/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails**

Run (from `frontend/`): `npx vitest run ProcessingPanel`
Expected: FAIL — cannot resolve `../ProcessingPanel`.

- [ ] **Step 3: Create `frontend/src/components/datasets/ProcessingPanel.tsx`**

```tsx
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { PipelineStep, PreparationSummary } from "../../lib/types";

const STEP_TYPES = ["drop_nulls", "impute", "standardize", "minmax", "one_hot"];

export function ProcessingPanel({
  datasetId,
  columns,
}: {
  datasetId: number;
  columns: string[];
}) {
  const [target, setTarget] = useState("");
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [summary, setSummary] = useState<PreparationSummary | null>(null);

  const apply = useMutation({
    mutationFn: async () => {
      await api.savePipeline(datasetId, {
        target,
        steps,
        train_ratio: 0.7,
        val_ratio: 0.15,
        seed: 42,
      });
      return api.applyPipeline(datasetId);
    },
    onSuccess: setSummary,
  });

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md flex flex-col gap-sm">
      <h3 className="text-headline-sm font-bold text-on-surface">Data Processing</h3>

      <label className="text-label-md uppercase text-on-surface-variant" htmlFor="target">
        Target
      </label>
      <select
        id="target"
        aria-label="Target"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        className="bg-surface border border-outline-variant rounded px-3 py-2 text-body-sm"
      >
        <option value="">Select target…</option>
        {columns.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <div className="flex flex-col gap-xs">
        {steps.map((s, i) => (
          <div
            key={i}
            className="flex items-center justify-between border border-outline-variant rounded px-3 py-2 bg-surface-container-low"
          >
            <span className="text-body-sm font-medium">
              {i + 1}. {s.type}
            </span>
            <button
              onClick={() => setSteps(steps.filter((_, j) => j !== i))}
              className="text-on-surface-variant hover:text-error material-symbols-outlined text-[18px]"
            >
              close
            </button>
          </div>
        ))}
      </div>

      <select
        aria-label="Add step"
        value=""
        onChange={(e) => {
          if (e.target.value) setSteps([...steps, { type: e.target.value, params: {} }]);
        }}
        className="bg-surface border border-outline-variant rounded px-3 py-2 text-body-sm"
      >
        <option value="">+ Add step</option>
        {STEP_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      <button
        disabled={!target || apply.isPending}
        onClick={() => apply.mutate()}
        className="px-6 py-2 bg-primary text-on-primary rounded-full font-semibold text-body-sm hover:brightness-110 disabled:opacity-50"
      >
        Apply Pipeline
      </button>

      {summary && (
        <div className="border-t border-outline-variant pt-sm mt-xs text-body-sm text-on-surface">
          <div className="text-label-md uppercase text-on-surface-variant mb-xs">Result</div>
          <div>
            {summary.task} · {summary.n_features} features
            {summary.task === "classification" ? ` · ${summary.n_classes} classes` : ""}
          </div>
          <div className="text-on-surface-variant">
            {summary.splits.train} train · {summary.splits.val} val · {summary.splits.test} test
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run ProcessingPanel`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/datasets/ProcessingPanel.tsx frontend/src/components/datasets/__tests__/ProcessingPanel.test.tsx
git commit -m "feat(frontend): add preprocessing Data Processing panel"
```

---

## Task 7: Mount panel + target distribution on Datasets page

**Files:**
- Modify: `frontend/src/pages/DatasetsPage.tsx`

- [ ] **Step 1: Import the panel in `frontend/src/pages/DatasetsPage.tsx`**

Add near the other imports:

```tsx
import { ProcessingPanel } from "../components/datasets/ProcessingPanel";
```

- [ ] **Step 2: Render the panel under the detail view**

In the detail block, after `{correlation && <CorrelationHeatmap correlation={correlation} />}`, add:

```tsx
            <ProcessingPanel
              datasetId={selectedId}
              columns={schema.map((c) => c.name)}
            />
```

- [ ] **Step 3: Run the dataset frontend tests + build**

Run: `npx vitest run datasets DatasetsPage ProcessingPanel` then `npm run build`
Expected: tests PASS, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/DatasetsPage.tsx
git commit -m "feat(frontend): mount Data Processing panel on Datasets page"
```

---

## Task 8: End-to-end UI verification

**Files:**
- Modify: `frontend/e2e/smoke.spec.ts`

- [ ] **Step 1: Append an E2E test to `frontend/e2e/smoke.spec.ts`**

```ts
test("preprocessing: build a pipeline and apply it", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Datasets" }).click();

  await page.setInputFiles('input[type="file"]', {
    name: "prep.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "age,city,label\n" +
        Array.from({ length: 20 }, (_, i) =>
          `${20 + i},${i % 2 ? "NY" : "LA"},${i % 3 ? "yes" : "no"}`
        ).join("\n") +
        "\n"
    ),
  });
  await page.getByRole("button", { name: "Upload CSV" }).click();
  await page.getByText("prep.csv").click();

  await expect(page.getByRole("heading", { name: "Data Processing" })).toBeVisible();
  await page.getByLabel("Target").selectOption("label");
  await page.getByLabel("Add step").selectOption("standardize");
  await page.getByLabel("Add step").selectOption("one_hot");
  await page.getByRole("button", { name: "Apply Pipeline" }).click();

  await expect(page.getByText(/classification/)).toBeVisible();
  await expect(page.getByText(/train/)).toBeVisible();
  await page.screenshot({ path: "e2e/screens/preprocessing.png", fullPage: true });
});
```

- [ ] **Step 2: Start backend with an isolated workspace (background)**

Run (from `backend/`): `MODELROOM_WORKSPACE="$(pwd)/.e2e_ws" .venv/Scripts/python -m uvicorn app.main:app --port 8000 --log-level warning`

- [ ] **Step 3: Start the frontend (background) and run the E2E**

Run (from `frontend/`): `npm run dev` (background), then `npx playwright test`
Expected: all 3 E2E tests pass.

- [ ] **Step 4: Visually inspect `frontend/e2e/screens/preprocessing.png`**

Confirm the Data Processing panel shows the target, the two steps, and the result summary (task/features/splits).

- [ ] **Step 5: Stop servers, clean workspace, run both unit suites**

```bash
# stop background uvicorn/vite
rm -rf backend/.e2e_ws frontend/test-results frontend/e2e/screens
cd backend && .venv/Scripts/python -m pytest -q
cd ../frontend && npm test
```
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add frontend/e2e/smoke.spec.ts
git commit -m "test(frontend): add preprocessing E2E"
```

---

## Self-Review Notes (against the spec)

- **Preprocessing — ordered steps, fit-on-train, deterministic, persisted:** Tasks 2 (pure pipeline, leakage-safe), 3 (npz persistence), 4 (save/get/apply API), 6–7 (UI builder).
- **Step coverage:** drop_nulls, impute, standardize, minmax, one_hot, target select, split — all in `pipeline.prepare` (Task 2) and selectable in the panel (Task 6).
- **Target/class distribution `[v0.1]`:** `summarize` returns `target_distribution`; surfaced in the result summary (Task 6). (A dedicated chart can be added later; the count breakdown is shown now.)
- **Output contract for Phase 4:** `prepare` returns `X_*/y_*` float32 + `feature_names/n_features/task/n_classes/classes` (Task 2) and persists via npz keyed by preparation id (Task 3) — Phase 4 training loads these.
- **Type consistency:** `PipelineSpec`, `PipelineStep`, `PreparationSummary` defined in Task 5, used in Tasks 6–7; API methods `savePipeline`/`applyPipeline` consistent across client and panel; backend `prepare`/`summarize` keys match what the router and store consume.
- **Realtime UI testing:** Task 8 drives the real browser, asserts the panel + result, and captures a screenshot for visual inspection.
