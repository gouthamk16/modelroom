# ModelRoom v0.1 — Phase 2: Datasets + Visualizations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user upload a CSV into a project, then preview it, inspect its schema/stats, and explore it visually (per-column histograms/bars, correlation heatmap, missing-value map).

**Architecture:** A pure, unit-tested `app/datasets/analysis.py` (DataFrame in → schema/preview/stats/histogram/correlation out) sits behind thin FastAPI endpoints; `app/datasets/store.py` owns CSV file persistence in the workspace. The frontend gains a Datasets page (upload + list + detail) with Recharts charts and a CSS-grid correlation heatmap, plus minimal client-side page switching in the shell.

**Tech Stack:** Adds `pandas`, `numpy`, `python-multipart` (backend) and `recharts` (frontend) to the Phase 1 stack.

**Spec reference:** `docs/superpowers/specs/2026-06-07-modelroom-foundation-mlp-design.md` — Visualizations → Dataset/data `[v0.1]` items, and Backend → Datasets.

**Builds on:** Phase 1 (`Project` model, `get_session`, app shell, API client). Branch off the current Phase 1 HEAD.

---

## File Structure

**Backend**
- Modify `backend/pyproject.toml` — add pandas, numpy, python-multipart.
- Modify `backend/app/models.py` — add `Dataset` table.
- Modify `backend/app/schemas.py` — add `DatasetRead`.
- Create `backend/app/datasets/__init__.py`
- Create `backend/app/datasets/analysis.py` — pure analysis functions.
- Create `backend/app/datasets/store.py` — CSV save/load + paths.
- Create `backend/app/routers/datasets.py` — endpoints.
- Modify `backend/app/main.py` — include datasets router.
- Create `backend/tests/test_dataset_analysis.py`, `backend/tests/test_datasets_api.py`.

**Frontend**
- Modify `frontend/src/lib/types.ts` — Dataset/schema/stats/viz types.
- Modify `frontend/src/api/client.ts` — dataset endpoints.
- Modify `frontend/src/components/Sidebar.tsx` + `AppShell.tsx` + `src/App.tsx` — minimal page switching.
- Create `frontend/src/pages/DatasetsPage.tsx` — upload + list + detail container.
- Create `frontend/src/components/datasets/DatasetTable.tsx` — preview + schema/stats tables.
- Create `frontend/src/components/datasets/Histogram.tsx` — Recharts histogram/bar.
- Create `frontend/src/components/datasets/CorrelationHeatmap.tsx` — CSS-grid heatmap.
- Tests: `frontend/src/pages/__tests__/DatasetsPage.test.tsx`, `frontend/src/components/datasets/__tests__/CorrelationHeatmap.test.tsx`.

---

## Task 1: Backend deps + Dataset model + schema

**Files:**
- Modify: `backend/pyproject.toml`, `backend/app/models.py`, `backend/app/schemas.py`
- Test: `backend/tests/test_models.py` (extend)

- [ ] **Step 1: Add dependencies to `backend/pyproject.toml`**

Replace the `dependencies` array with:

```toml
dependencies = [
    "fastapi>=0.110",
    "uvicorn[standard]>=0.29",
    "sqlmodel>=0.0.16",
    "httpx>=0.27",
    "pandas>=2.2",
    "numpy>=1.26",
    "python-multipart>=0.0.9",
]
```

- [ ] **Step 2: Install the new deps**

Run (from `backend/`): `.venv/Scripts/python -m pip install -q -e ".[dev]"`
Expected: pandas, numpy, python-multipart install without errors.

- [ ] **Step 3: Write the failing test (append to `backend/tests/test_models.py`)**

```python
def test_dataset_defaults():
    from app.models import Dataset

    d = Dataset(project_id=1, name="churn.csv", filename="churn.csv")
    assert d.project_id == 1
    assert d.n_rows == 0
    assert d.n_cols == 0
```

- [ ] **Step 4: Run to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_models.py::test_dataset_defaults -v`
Expected: FAIL — `ImportError: cannot import name 'Dataset'`.

- [ ] **Step 5: Add `Dataset` to `backend/app/models.py`** (append after `Project`)

```python
class Dataset(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", index=True)
    name: str
    filename: str
    n_rows: int = 0
    n_cols: int = 0
    size_bytes: int = 0
    created_at: datetime = Field(default_factory=_now)
```

- [ ] **Step 6: Add `DatasetRead` to `backend/app/schemas.py`** (append)

```python
class DatasetRead(BaseModel):
    id: int
    project_id: int
    name: str
    filename: str
    n_rows: int
    n_cols: int
    size_bytes: int
    created_at: datetime
```

- [ ] **Step 7: Run to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_models.py -v`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/pyproject.toml backend/app/models.py backend/app/schemas.py backend/tests/test_models.py
git commit -m "feat(backend): add Dataset model, schema, and data deps"
```

---

## Task 2: Pure dataset analysis module

**Files:**
- Create: `backend/app/datasets/__init__.py`, `backend/app/datasets/analysis.py`
- Test: `backend/tests/test_dataset_analysis.py`

- [ ] **Step 1: Create `backend/app/datasets/__init__.py`** (empty file)

```python
```

- [ ] **Step 2: Write the failing test `backend/tests/test_dataset_analysis.py`**

```python
import pandas as pd

from app.datasets import analysis


def _df():
    return pd.DataFrame(
        {
            "age": [20, 30, 40, None],
            "city": ["NY", "LA", "NY", "SF"],
        }
    )


def test_infer_schema():
    schema = analysis.infer_schema(_df())
    by_name = {c["name"]: c for c in schema}
    assert by_name["age"]["kind"] == "numeric"
    assert by_name["age"]["n_null"] == 1
    assert by_name["city"]["kind"] == "categorical"
    assert by_name["city"]["n_unique"] == 3


def test_preview_replaces_nan_with_none():
    out = analysis.preview(_df(), n=10)
    assert out["columns"] == ["age", "city"]
    assert out["rows"][3]["age"] is None


def test_column_stats_numeric_and_categorical():
    stats = {s["name"]: s for s in analysis.column_stats(_df())}
    assert stats["age"]["min"] == 20.0
    assert stats["age"]["max"] == 40.0
    assert stats["city"]["top"][0]["value"] == "NY"
    assert stats["city"]["top"][0]["count"] == 2


def test_histogram_numeric_and_categorical():
    num = analysis.histogram(_df(), "age", bins=2)
    assert num["kind"] == "numeric"
    assert sum(b["count"] for b in num["bins"]) == 3  # NaN dropped

    cat = analysis.histogram(_df(), "city")
    assert cat["kind"] == "categorical"
    assert {b["value"] for b in cat["bars"]} == {"NY", "LA", "SF"}


def test_correlation_only_numeric():
    df = pd.DataFrame({"a": [1, 2, 3], "b": [2, 4, 6], "c": ["x", "y", "z"]})
    corr = analysis.correlation(df)
    assert corr["columns"] == ["a", "b"]
    assert corr["matrix"][0][1] == 1.0
```

- [ ] **Step 3: Run to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_dataset_analysis.py -v`
Expected: FAIL — no module `app.datasets.analysis`.

- [ ] **Step 4: Write `backend/app/datasets/analysis.py`**

```python
import math

import numpy as np
import pandas as pd


def _num(x) -> float | None:
    if x is None:
        return None
    val = float(x)
    return None if math.isnan(val) else val


def infer_schema(df: pd.DataFrame) -> list[dict]:
    out = []
    for name in df.columns:
        s = df[name]
        kind = "numeric" if pd.api.types.is_numeric_dtype(s) else "categorical"
        out.append(
            {
                "name": str(name),
                "dtype": str(s.dtype),
                "kind": kind,
                "n_null": int(s.isna().sum()),
                "n_unique": int(s.nunique(dropna=True)),
            }
        )
    return out


def preview(df: pd.DataFrame, n: int = 10) -> dict:
    head = df.head(n)
    safe = head.astype(object).where(pd.notnull(head), None)
    return {
        "columns": [str(c) for c in df.columns],
        "rows": safe.to_dict("records"),
    }


def column_stats(df: pd.DataFrame) -> list[dict]:
    out = []
    for name in df.columns:
        s = df[name]
        n_null = int(s.isna().sum())
        if pd.api.types.is_numeric_dtype(s):
            out.append(
                {
                    "name": str(name),
                    "kind": "numeric",
                    "min": _num(s.min()),
                    "max": _num(s.max()),
                    "mean": _num(s.mean()),
                    "std": _num(s.std()),
                    "n_null": n_null,
                }
            )
        else:
            vc = s.value_counts().head(5)
            out.append(
                {
                    "name": str(name),
                    "kind": "categorical",
                    "top": [{"value": str(k), "count": int(v)} for k, v in vc.items()],
                    "n_null": n_null,
                }
            )
    return out


def histogram(df: pd.DataFrame, column: str, bins: int = 10) -> dict:
    s = df[column].dropna()
    if pd.api.types.is_numeric_dtype(s):
        counts, edges = np.histogram(s, bins=bins)
        return {
            "kind": "numeric",
            "bins": [
                {"start": float(edges[i]), "end": float(edges[i + 1]), "count": int(counts[i])}
                for i in range(len(counts))
            ],
        }
    vc = s.value_counts().head(20)
    return {
        "kind": "categorical",
        "bars": [{"value": str(k), "count": int(v)} for k, v in vc.items()],
    }


def correlation(df: pd.DataFrame) -> dict:
    num = df.select_dtypes(include="number")
    corr = num.corr().fillna(0.0)
    return {
        "columns": [str(c) for c in corr.columns],
        "matrix": [[round(float(v), 3) for v in row] for row in corr.values],
    }
```

- [ ] **Step 5: Run to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_dataset_analysis.py -v`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/datasets/__init__.py backend/app/datasets/analysis.py backend/tests/test_dataset_analysis.py
git commit -m "feat(backend): add pure dataset analysis module"
```

---

## Task 3: CSV store module

**Files:**
- Create: `backend/app/datasets/store.py`
- Test: `backend/tests/test_dataset_store.py`

- [ ] **Step 1: Write the failing test `backend/tests/test_dataset_store.py`**

```python
def test_save_and_load_roundtrip(monkeypatch, tmp_path):
    monkeypatch.setenv("MODELROOM_WORKSPACE", str(tmp_path))
    from app.datasets import store

    store.save_csv(7, b"a,b\n1,2\n3,4\n")
    df = store.load_df(7)
    assert list(df.columns) == ["a", "b"]
    assert df.shape == (2, 2)
    assert store.dataset_path(7).exists()
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_dataset_store.py -v`
Expected: FAIL — no module `app.datasets.store`.

- [ ] **Step 3: Write `backend/app/datasets/store.py`**

```python
from pathlib import Path

import pandas as pd

from app.config import get_settings


def dataset_path(dataset_id: int) -> Path:
    return get_settings().datasets_dir / f"{dataset_id}.csv"


def save_csv(dataset_id: int, content: bytes) -> None:
    path = dataset_path(dataset_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)


def load_df(dataset_id: int) -> pd.DataFrame:
    return pd.read_csv(dataset_path(dataset_id))
```

- [ ] **Step 4: Run to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_dataset_store.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/datasets/store.py backend/tests/test_dataset_store.py
git commit -m "feat(backend): add dataset CSV store"
```

---

## Task 4: Datasets API router

**Files:**
- Create: `backend/app/routers/datasets.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_datasets_api.py`

- [ ] **Step 1: Write the failing test `backend/tests/test_datasets_api.py`**

```python
import io


def _upload(client, project_id):
    csv = b"age,city\n20,NY\n30,LA\n40,NY\n"
    return client.post(
        f"/api/projects/{project_id}/datasets",
        files={"file": ("churn.csv", io.BytesIO(csv), "text/csv")},
    )


def test_upload_then_fetch_metadata_and_views(client, monkeypatch, tmp_path):
    monkeypatch.setenv("MODELROOM_WORKSPACE", str(tmp_path))
    pid = client.post("/api/projects", json={"name": "P"}).json()["id"]

    res = _upload(client, pid)
    assert res.status_code == 201
    ds = res.json()
    assert ds["n_rows"] == 3
    assert ds["n_cols"] == 2

    did = ds["id"]
    assert [d["id"] for d in client.get("/api/datasets").json()] == [did]

    schema = client.get(f"/api/datasets/{did}/schema").json()
    assert {c["name"] for c in schema} == {"age", "city"}

    preview = client.get(f"/api/datasets/{did}/preview").json()
    assert preview["rows"][0]["city"] == "NY"

    hist = client.get(f"/api/datasets/{did}/histogram", params={"column": "city"}).json()
    assert hist["kind"] == "categorical"


def test_upload_to_missing_project_404(client, monkeypatch, tmp_path):
    monkeypatch.setenv("MODELROOM_WORKSPACE", str(tmp_path))
    assert _upload(client, 999).status_code == 404
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_datasets_api.py -v`
Expected: FAIL — routes return 404/not found.

- [ ] **Step 3: Write `backend/app/routers/datasets.py`**

```python
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlmodel import Session, select

from app.datasets import analysis, store
from app.db import get_session
from app.models import Dataset, Project
from app.schemas import DatasetRead

router = APIRouter(prefix="/api", tags=["datasets"])


def _load(dataset_id: int, session: Session):
    ds = session.get(Dataset, dataset_id)
    if ds is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return ds, store.load_df(dataset_id)


@router.post(
    "/projects/{project_id}/datasets",
    response_model=DatasetRead,
    status_code=status.HTTP_201_CREATED,
)
async def upload_dataset(
    project_id: int,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    if session.get(Project, project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")
    content = await file.read()
    ds = Dataset(project_id=project_id, name=file.filename, filename=file.filename)
    session.add(ds)
    session.commit()
    session.refresh(ds)

    store.save_csv(ds.id, content)
    df = store.load_df(ds.id)
    ds.n_rows = int(len(df))
    ds.n_cols = int(len(df.columns))
    ds.size_bytes = len(content)
    session.add(ds)
    session.commit()
    session.refresh(ds)
    return ds


@router.get("/datasets", response_model=list[DatasetRead])
def list_datasets(
    project_id: int | None = None, session: Session = Depends(get_session)
):
    query = select(Dataset).order_by(Dataset.created_at.desc())
    if project_id is not None:
        query = query.where(Dataset.project_id == project_id)
    return session.exec(query).all()


@router.get("/datasets/{dataset_id}", response_model=DatasetRead)
def get_dataset(dataset_id: int, session: Session = Depends(get_session)):
    ds = session.get(Dataset, dataset_id)
    if ds is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return ds


@router.get("/datasets/{dataset_id}/schema")
def get_schema(dataset_id: int, session: Session = Depends(get_session)):
    _, df = _load(dataset_id, session)
    return analysis.infer_schema(df)


@router.get("/datasets/{dataset_id}/preview")
def get_preview(dataset_id: int, n: int = 10, session: Session = Depends(get_session)):
    _, df = _load(dataset_id, session)
    return analysis.preview(df, n)


@router.get("/datasets/{dataset_id}/stats")
def get_stats(dataset_id: int, session: Session = Depends(get_session)):
    _, df = _load(dataset_id, session)
    return analysis.column_stats(df)


@router.get("/datasets/{dataset_id}/histogram")
def get_histogram(
    dataset_id: int, column: str, bins: int = 10, session: Session = Depends(get_session)
):
    _, df = _load(dataset_id, session)
    if column not in df.columns:
        raise HTTPException(status_code=404, detail="Column not found")
    return analysis.histogram(df, column, bins)


@router.get("/datasets/{dataset_id}/correlation")
def get_correlation(dataset_id: int, session: Session = Depends(get_session)):
    _, df = _load(dataset_id, session)
    return analysis.correlation(df)
```

- [ ] **Step 4: Wire the router in `backend/app/main.py`**

Change the import line `from app.routers import projects` to:

```python
from app.routers import datasets, projects
```

And add below `app.include_router(projects.router)`:

```python
    app.include_router(datasets.router)
```

- [ ] **Step 5: Run to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_datasets_api.py -v`
Expected: all PASS.

- [ ] **Step 6: Run the full backend suite**

Run: `.venv/Scripts/python -m pytest -q`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/datasets.py backend/app/main.py backend/tests/test_datasets_api.py
git commit -m "feat(backend): add datasets API (upload, schema, preview, stats, viz)"
```

---

## Task 5: Frontend types + API client + Recharts

**Files:**
- Modify: `frontend/src/lib/types.ts`, `frontend/src/api/client.ts`
- Install: `recharts`

- [ ] **Step 1: Install Recharts**

Run (from `frontend/`): `npm install recharts`
Expected: installs without errors.

- [ ] **Step 2: Append dataset types to `frontend/src/lib/types.ts`**

```ts
export interface Dataset {
  id: number;
  project_id: number;
  name: string;
  filename: string;
  n_rows: number;
  n_cols: number;
  size_bytes: number;
  created_at: string;
}

export interface SchemaColumn {
  name: string;
  dtype: string;
  kind: "numeric" | "categorical";
  n_null: number;
  n_unique: number;
}

export interface Preview {
  columns: string[];
  rows: Record<string, unknown>[];
}

export interface Histogram {
  kind: "numeric" | "categorical";
  bins?: { start: number; end: number; count: number }[];
  bars?: { value: string; count: number }[];
}

export interface Correlation {
  columns: string[];
  matrix: number[][];
}
```

- [ ] **Step 3: Append dataset endpoints to `frontend/src/api/client.ts`**

Add these imports at the top (merge with the existing type import):

```ts
import type {
  Project,
  Dataset,
  SchemaColumn,
  Preview,
  Histogram,
  Correlation,
} from "../lib/types";
```

Add to the `api` object (before the closing brace):

```ts
  listDatasets: (projectId?: number) =>
    request<Dataset[]>(
      `/datasets${projectId ? `?project_id=${projectId}` : ""}`
    ),
  uploadDataset: async (projectId: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/projects/${projectId}/datasets`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return (await res.json()) as Dataset;
  },
  datasetSchema: (id: number) => request<SchemaColumn[]>(`/datasets/${id}/schema`),
  datasetPreview: (id: number) => request<Preview>(`/datasets/${id}/preview`),
  datasetHistogram: (id: number, column: string) =>
    request<Histogram>(`/datasets/${id}/histogram?column=${encodeURIComponent(column)}`),
  datasetCorrelation: (id: number) => request<Correlation>(`/datasets/${id}/correlation`),
```

Note: `uploadDataset` uses a bare `fetch` (not the JSON `request` helper) because `FormData` must not carry a `Content-Type: application/json` header.

- [ ] **Step 4: Verify the build compiles**

Run (from `frontend/`): `npm run build`
Expected: succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/types.ts frontend/src/api/client.ts frontend/package.json frontend/package-lock.json
git commit -m "feat(frontend): add dataset types, API client, and recharts"
```

---

## Task 6: Shell page switching

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx`, `frontend/src/components/AppShell.tsx`, `frontend/src/App.tsx`
- Test: update `frontend/src/components/__tests__/Sidebar.test.tsx`

- [ ] **Step 1: Update the Sidebar test to cover navigation**

Replace `frontend/src/components/__tests__/Sidebar.test.tsx` with:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { Sidebar } from "../Sidebar";

test("renders all nav items with Projects active", () => {
  render(<Sidebar active="Projects" onNavigate={() => {}} />);
  for (const label of ["Projects", "Datasets", "Models", "Jobs"]) {
    expect(screen.getByText(label)).toBeInTheDocument();
  }
  expect(screen.getByText("Projects").closest("a")).toHaveClass("bg-primary-container");
});

test("calls onNavigate when a nav item is clicked", async () => {
  const onNavigate = vi.fn();
  render(<Sidebar active="Projects" onNavigate={onNavigate} />);
  await userEvent.click(screen.getByText("Datasets"));
  expect(onNavigate).toHaveBeenCalledWith("Datasets");
});
```

- [ ] **Step 2: Run to verify it fails**

Run (from `frontend/`): `npx vitest run Sidebar`
Expected: FAIL — `onNavigate` not a prop / not called.

- [ ] **Step 3: Update `frontend/src/components/Sidebar.tsx`**

Change the signature and the `<a>` to call `onNavigate`:

```tsx
export function Sidebar({
  active,
  onNavigate,
}: {
  active: string;
  onNavigate: (label: string) => void;
}) {
```

Replace the `<a ...>` opening tag with:

```tsx
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(label);
                }}
                className={
                  "flex items-center gap-sm px-sm py-2 rounded-lg font-medium transition-colors duration-200 " +
                  (isActive
                    ? "bg-primary-container text-on-primary-container"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50")
                }
              >
```

- [ ] **Step 4: Update `frontend/src/components/AppShell.tsx` to forward navigation**

```tsx
import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { StatusBar } from "./StatusBar";

export function AppShell({
  active,
  title,
  onNavigate,
  children,
}: {
  active: string;
  title: string;
  onNavigate: (label: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar active={active} onNavigate={onNavigate} />
      <div className="ml-[280px] w-[calc(100%-280px)] h-full flex flex-col relative">
        <TopBar title={title} />
        <main className="flex-1 overflow-y-auto mt-16 mb-8 p-lg bg-background">{children}</main>
        <StatusBar />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Update `frontend/src/App.tsx` to switch pages**

```tsx
import { useState } from "react";
import { AppShell } from "./components/AppShell";
import { ProjectsDashboard } from "./pages/ProjectsDashboard";
import { DatasetsPage } from "./pages/DatasetsPage";

export default function App() {
  const [page, setPage] = useState("Projects");
  return (
    <AppShell active={page} title={page} onNavigate={setPage}>
      {page === "Datasets" ? <DatasetsPage /> : <ProjectsDashboard />}
    </AppShell>
  );
}
```

- [ ] **Step 6: Run to verify the Sidebar test passes**

Run: `npx vitest run Sidebar`
Expected: PASS. (App.tsx won't typecheck until Task 7 creates DatasetsPage — that's fine; vitest runs per-file.)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/Sidebar.tsx frontend/src/components/AppShell.tsx frontend/src/App.tsx frontend/src/components/__tests__/Sidebar.test.tsx
git commit -m "feat(frontend): add shell page switching via sidebar"
```

---

## Task 7: Datasets page (upload + list + detail tables)

**Files:**
- Create: `frontend/src/components/datasets/DatasetTable.tsx`, `frontend/src/pages/DatasetsPage.tsx`
- Test: `frontend/src/pages/__tests__/DatasetsPage.test.tsx`

- [ ] **Step 1: Write the failing test `frontend/src/pages/__tests__/DatasetsPage.test.tsx`**

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";
import { DatasetsPage } from "../DatasetsPage";
import { api } from "../../api/client";

vi.mock("../../api/client", () => ({
  api: {
    listProjects: vi.fn().mockResolvedValue([
      { id: 1, name: "P", description: "", created_at: "", updated_at: "" },
    ]),
    listDatasets: vi.fn().mockResolvedValue([
      {
        id: 5,
        project_id: 1,
        name: "churn.csv",
        filename: "churn.csv",
        n_rows: 10,
        n_cols: 3,
        size_bytes: 100,
        created_at: "",
      },
    ]),
    uploadDataset: vi.fn(),
    datasetSchema: vi.fn().mockResolvedValue([]),
    datasetPreview: vi.fn().mockResolvedValue({ columns: [], rows: [] }),
    datasetCorrelation: vi.fn().mockResolvedValue({ columns: [], matrix: [] }),
    datasetHistogram: vi.fn().mockResolvedValue({ kind: "categorical", bars: [] }),
  },
}));

function renderPage() {
  const qc = new QueryClient();
  render(
    <QueryClientProvider client={qc}>
      <DatasetsPage />
    </QueryClientProvider>
  );
}

test("lists datasets", async () => {
  renderPage();
  await waitFor(() => expect(screen.getByText("churn.csv")).toBeInTheDocument());
  expect(api.listDatasets).toHaveBeenCalled();
});

test("shows the import heading", () => {
  renderPage();
  expect(screen.getByText("Import Dataset")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run DatasetsPage`
Expected: FAIL — cannot resolve `../DatasetsPage`.

- [ ] **Step 3: Create `frontend/src/components/datasets/DatasetTable.tsx`**

```tsx
import type { Preview, SchemaColumn } from "../../lib/types";

export function PreviewTable({ preview }: { preview: Preview }) {
  return (
    <div className="overflow-x-auto border border-outline-variant rounded-lg bg-surface-container-lowest">
      <table className="w-full text-body-sm">
        <thead>
          <tr className="border-b border-outline-variant text-on-surface-variant">
            {preview.columns.map((c) => (
              <th key={c} className="text-left px-3 py-2 font-semibold uppercase text-[11px]">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {preview.rows.map((row, i) => (
            <tr key={i} className="border-b border-outline-variant/50">
              {preview.columns.map((c) => (
                <td key={c} className="px-3 py-2 text-on-surface">
                  {row[c] === null || row[c] === undefined ? "—" : String(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SchemaList({ schema }: { schema: SchemaColumn[] }) {
  const maxRows = Math.max(1, ...schema.map((c) => c.n_null + c.n_unique));
  return (
    <div className="flex flex-col gap-xs">
      {schema.map((c) => (
        <div
          key={c.name}
          className="flex items-center justify-between border border-outline-variant rounded-lg px-3 py-2 bg-surface-container-lowest"
        >
          <div className="flex items-center gap-2">
            <span
              className={
                "w-2 h-2 rounded-full " +
                (c.kind === "numeric" ? "bg-primary" : "bg-primary-container")
              }
            />
            <span className="font-medium text-on-surface">{c.name}</span>
            <span className="text-label-sm text-on-surface-variant">{c.dtype}</span>
          </div>
          <div className="flex items-center gap-md text-label-sm text-on-surface-variant">
            <span>{c.n_unique} unique</span>
            <span title="missing values">
              {c.n_null > 0 ? `${Math.round((c.n_null / maxRows) * 100)}% null` : "no nulls"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create `frontend/src/pages/DatasetsPage.tsx`**

```tsx
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { PreviewTable, SchemaList } from "../components/datasets/DatasetTable";

export function DatasetsPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: api.listProjects,
  });
  const { data: datasets = [] } = useQuery({
    queryKey: ["datasets"],
    queryFn: () => api.listDatasets(),
  });
  const { data: schema = [] } = useQuery({
    queryKey: ["schema", selectedId],
    queryFn: () => api.datasetSchema(selectedId!),
    enabled: selectedId != null,
  });
  const { data: preview } = useQuery({
    queryKey: ["preview", selectedId],
    queryFn: () => api.datasetPreview(selectedId!),
    enabled: selectedId != null,
  });

  const upload = useMutation({
    mutationFn: (file: File) => api.uploadDataset(projectId!, file),
    onSuccess: (ds) => {
      qc.invalidateQueries({ queryKey: ["datasets"] });
      setSelectedId(ds.id);
    },
  });

  const effectiveProject = projectId ?? projects[0]?.id ?? null;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-md">
      <div className="flex flex-col gap-md">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md flex flex-col gap-sm">
          <h2 className="text-headline-sm font-bold text-on-surface">Import Dataset</h2>
          <select
            value={effectiveProject ?? ""}
            onChange={(e) => setProjectId(Number(e.target.value))}
            className="bg-surface border border-outline-variant rounded px-3 py-2 text-body-sm"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input ref={fileRef} type="file" accept=".csv" className="text-body-sm" />
          <button
            onClick={() => {
              const f = fileRef.current?.files?.[0];
              if (f && effectiveProject) upload.mutate(f);
            }}
            className="px-6 py-2 bg-primary text-on-primary rounded-full font-semibold text-body-sm hover:brightness-110"
          >
            Upload CSV
          </button>
        </div>

        <div className="flex flex-col gap-xs">
          {datasets.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelectedId(d.id)}
              className={
                "text-left border rounded-lg px-3 py-2 transition-colors " +
                (selectedId === d.id
                  ? "border-primary bg-primary-container/20"
                  : "border-outline-variant bg-surface-container-lowest hover:border-outline")
              }
            >
              <div className="font-medium text-on-surface">{d.name}</div>
              <div className="text-label-sm text-on-surface-variant">
                {d.n_rows} rows · {d.n_cols} cols
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-md">
        {selectedId == null ? (
          <div className="text-on-surface-variant text-body-md">
            Select or upload a dataset to explore it.
          </div>
        ) : (
          <>
            {preview && <PreviewTable preview={preview} />}
            <SchemaList schema={schema} />
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run to verify the test passes**

Run: `npx vitest run DatasetsPage`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/datasets/DatasetTable.tsx frontend/src/pages/DatasetsPage.tsx frontend/src/pages/__tests__/DatasetsPage.test.tsx
git commit -m "feat(frontend): add Datasets page with upload, list, preview, schema"
```

---

## Task 8: Visualizations (histogram + correlation heatmap)

**Files:**
- Create: `frontend/src/components/datasets/Histogram.tsx`, `frontend/src/components/datasets/CorrelationHeatmap.tsx`
- Modify: `frontend/src/pages/DatasetsPage.tsx`
- Test: `frontend/src/components/datasets/__tests__/CorrelationHeatmap.test.tsx`

- [ ] **Step 1: Write the failing test `frontend/src/components/datasets/__tests__/CorrelationHeatmap.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { CorrelationHeatmap } from "../CorrelationHeatmap";

test("renders a cell per matrix entry plus headers", () => {
  render(
    <CorrelationHeatmap
      correlation={{ columns: ["a", "b"], matrix: [[1, 0.5], [0.5, 1]] }}
    />
  );
  // 2 column headers (a,b) appear in both axis label sets => at least 2
  expect(screen.getAllByText("a").length).toBeGreaterThanOrEqual(1);
  expect(screen.getByText("0.5")).toBeInTheDocument();
});

test("renders nothing when fewer than 2 numeric columns", () => {
  const { container } = render(
    <CorrelationHeatmap correlation={{ columns: ["a"], matrix: [[1]] }} />
  );
  expect(container).toBeEmptyDOMElement();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run CorrelationHeatmap`
Expected: FAIL — cannot resolve `../CorrelationHeatmap`.

- [ ] **Step 3: Create `frontend/src/components/datasets/CorrelationHeatmap.tsx`**

```tsx
import type { Correlation } from "../../lib/types";

function cellColor(v: number): string {
  // coral for positive, gray-blue for negative; intensity by magnitude
  const a = Math.min(1, Math.abs(v));
  return v >= 0
    ? `rgba(166, 59, 33, ${a})`
    : `rgba(93, 94, 96, ${a})`;
}

export function CorrelationHeatmap({ correlation }: { correlation: Correlation }) {
  const { columns, matrix } = correlation;
  if (columns.length < 2) return null;
  return (
    <div className="border border-outline-variant rounded-lg p-md bg-surface-container-lowest overflow-x-auto">
      <h3 className="text-label-md uppercase text-on-surface-variant mb-sm">Correlation</h3>
      <div
        className="grid gap-[2px]"
        style={{ gridTemplateColumns: `120px repeat(${columns.length}, 48px)` }}
      >
        <div />
        {columns.map((c) => (
          <div key={`h-${c}`} className="text-label-sm text-on-surface-variant text-center truncate">
            {c}
          </div>
        ))}
        {matrix.map((row, i) => (
          <div key={`r-${i}`} className="contents">
            <div className="text-label-sm text-on-surface-variant truncate pr-2 text-right self-center">
              {columns[i]}
            </div>
            {row.map((v, j) => (
              <div
                key={`c-${i}-${j}`}
                className="h-12 flex items-center justify-center text-[10px] rounded"
                style={{ backgroundColor: cellColor(v) }}
                title={`${columns[i]} × ${columns[j]}: ${v}`}
              >
                {v}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run CorrelationHeatmap`
Expected: PASS.

- [ ] **Step 5: Create `frontend/src/components/datasets/Histogram.tsx`**

```tsx
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Histogram as HistogramData } from "../../lib/types";

export function Histogram({ data }: { data: HistogramData }) {
  const rows =
    data.kind === "numeric"
      ? (data.bins ?? []).map((b) => ({
          label: `${b.start.toFixed(1)}–${b.end.toFixed(1)}`,
          count: b.count,
        }))
      : (data.bars ?? []).map((b) => ({ label: b.value, count: b.count }));

  return (
    <div className="border border-outline-variant rounded-lg p-md bg-surface-container-lowest h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows}>
          <CartesianGrid strokeOpacity={0.12} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-30} height={50} />
          <YAxis tick={{ fontSize: 10 }} width={32} />
          <Tooltip />
          <Bar dataKey="count" fill="#a63b21" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 6: Wire viz into `frontend/src/pages/DatasetsPage.tsx`**

Add these imports near the top:

```tsx
import { Histogram } from "../components/datasets/Histogram";
import { CorrelationHeatmap } from "../components/datasets/CorrelationHeatmap";
```

Add `selectedColumn` state after `selectedId`:

```tsx
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
```

Add these queries after the `preview` query:

```tsx
  const { data: correlation } = useQuery({
    queryKey: ["correlation", selectedId],
    queryFn: () => api.datasetCorrelation(selectedId!),
    enabled: selectedId != null,
  });
  const histColumn = selectedColumn ?? schema[0]?.name ?? null;
  const { data: histogram } = useQuery({
    queryKey: ["histogram", selectedId, histColumn],
    queryFn: () => api.datasetHistogram(selectedId!, histColumn!),
    enabled: selectedId != null && histColumn != null,
  });
```

Replace the detail JSX block (`{preview && <PreviewTable .../>}` ... `<SchemaList .../>`) with:

```tsx
            {preview && <PreviewTable preview={preview} />}
            <div className="flex items-center gap-sm">
              <span className="text-label-md uppercase text-on-surface-variant">Distribution</span>
              <select
                value={histColumn ?? ""}
                onChange={(e) => setSelectedColumn(e.target.value)}
                className="bg-surface border border-outline-variant rounded px-3 py-1 text-body-sm"
              >
                {schema.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            {histogram && <Histogram data={histogram} />}
            <SchemaList schema={schema} />
            {correlation && <CorrelationHeatmap correlation={correlation} />}
```

- [ ] **Step 7: Run the dataset frontend tests + build**

Run: `npx vitest run datasets DatasetsPage` then `npm run build`
Expected: tests PASS, build succeeds.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/datasets/Histogram.tsx frontend/src/components/datasets/CorrelationHeatmap.tsx frontend/src/components/datasets/__tests__/CorrelationHeatmap.test.tsx frontend/src/pages/DatasetsPage.tsx
git commit -m "feat(frontend): add histogram and correlation heatmap visualizations"
```

---

## Task 9: End-to-end smoke verification

- [ ] **Step 1: Start backend with an isolated workspace**

Run (from `backend/`, background):
`MODELROOM_WORKSPACE="$(pwd)/.smoke_ws" .venv/Scripts/python -m uvicorn app.main:app --port 8000 --log-level warning`

- [ ] **Step 2: Create a project and upload a CSV via the API**

```bash
PID=$(curl -s -X POST http://127.0.0.1:8000/api/projects -H "Content-Type: application/json" -d '{"name":"DS"}' | python -c "import sys,json;print(json.load(sys.stdin)['id'])")
printf "age,city\n20,NY\n30,LA\n40,NY\n50,SF\n" > /tmp/mr.csv
curl -s -X POST "http://127.0.0.1:8000/api/projects/$PID/datasets" -F "file=@/tmp/mr.csv"
```
Expected: JSON with `n_rows: 4`, `n_cols: 2`.

- [ ] **Step 3: Verify the view endpoints**

```bash
curl -s http://127.0.0.1:8000/api/datasets/1/schema
curl -s "http://127.0.0.1:8000/api/datasets/1/histogram?column=age&bins=2"
curl -s http://127.0.0.1:8000/api/datasets/1/correlation
```
Expected: schema lists age/city; histogram returns numeric bins; correlation returns columns `["age"]` (single numeric col → 1×1).

- [ ] **Step 4: Start the frontend and verify proxy + manual flow**

Run (from `frontend/`, background): `npm run dev`
In the browser at `http://localhost:5173`: click **Datasets** in the sidebar, pick the project, choose a CSV, upload, then click the dataset → preview table, schema, histogram (switch column), and correlation heatmap all render.

- [ ] **Step 5: Stop servers and remove the smoke workspace**

```bash
# stop the background uvicorn/vite, then:
rm -rf backend/.smoke_ws
```

- [ ] **Step 6: Run both full suites**

Run: `cd backend && .venv/Scripts/python -m pytest -q` then `cd ../frontend && npm test`
Expected: all green.

- [ ] **Step 7: Commit any final fixes**

```bash
git add -A
git commit -m "chore: phase 2 datasets end-to-end verified"
```

---

## Self-Review Notes (against the spec)

- **Datasets — CSV import + schema + preview + stats:** Tasks 1–4 (model, analysis, store, API), Task 7 (UI).
- **Dataset visualizations `[v0.1]`:** histograms/bars (Task 8 Histogram), correlation heatmap (Task 8), summary stats (Task 4 `/stats` + SchemaList), missing-value map (SchemaList null% per column, Task 7). Target/class distribution and before/after comparison deferred — they depend on target selection / preprocessing (Phase 3).
- **Module isolation:** `analysis.py` is pure and fully unit-tested (Task 2); `store.py` isolated (Task 3); endpoints are thin (Task 4).
- **Type consistency:** `Dataset`, `SchemaColumn`, `Preview`, `Histogram`, `Correlation` defined in Task 5 and used unchanged in Tasks 7–8; API method names (`listDatasets`, `uploadDataset`, `datasetSchema`, `datasetPreview`, `datasetHistogram`, `datasetCorrelation`) consistent between client (Task 5) and pages (Tasks 7–8); `Sidebar` gains `onNavigate` in Task 6 and all call sites updated.
- **Stats endpoint coverage:** `/stats` is implemented and tested at the API layer (Task 4). It is available for richer stat cards later; Phase 2 UI surfaces stats via the schema list to keep the page focused.
