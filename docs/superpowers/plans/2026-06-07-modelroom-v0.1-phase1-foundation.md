# ModelRoom v0.1 — Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the ModelRoom monorepo — a FastAPI backend with SQLite-backed Projects CRUD and a React+Vite+Tailwind frontend rendering the `Precision Radiance` app shell and a working Projects dashboard wired to the API.

**Architecture:** Local two-process app. Python FastAPI backend (REST) owns persistence via SQLModel/SQLite in a workspace dir. React+Vite+Tailwind frontend talks to it over localhost (Vite dev proxy). This phase establishes the skeleton every later phase plugs into: storage, app shell, design tokens, and the first end-to-end CRUD page.

**Tech Stack:** Python 3.11+, FastAPI, Uvicorn, SQLModel, pytest, httpx. Node 20+, Vite, React 18, TypeScript, TailwindCSS, @tanstack/react-query, Vitest, @testing-library/react.

**Design reference:** `design_idea/precision_radiance/DESIGN.md` (tokens) and `design_idea/projects_dashboard_light/code.html` (shell + dashboard markup). Mirror the sidebar/topbar/statusbar structure and class usage from that file.

**Phase roadmap (context):** 1 Foundation (this) → 2 Datasets+viz → 3 Preprocessing → 4 Model builder + shape engine → 5 Training/jobs/checkpointing → 6 Evaluation/registry/interpretation. Each phase is its own plan.

---

## File Structure

**Backend (`backend/`)**
- `pyproject.toml` — deps + pytest config.
- `app/__init__.py` — package marker.
- `app/config.py` — workspace dir resolution (single responsibility: paths/settings).
- `app/db.py` — engine + session dependency + `init_db()`.
- `app/models.py` — SQLModel tables (Phase 1: `Project`).
- `app/schemas.py` — request/response Pydantic models for `Project`.
- `app/routers/__init__.py`
- `app/routers/projects.py` — Projects CRUD router.
- `app/main.py` — app factory, CORS, router wiring, startup `init_db()`, `/health`.
- `tests/conftest.py` — test client with isolated temp DB.
- `tests/test_health.py`, `tests/test_projects.py`.

**Frontend (`frontend/`)**
- Vite React-TS scaffold (`index.html`, `src/main.tsx`, `vite.config.ts`, `tsconfig.json`, `package.json`).
- `tailwind.config.js`, `postcss.config.js` — Precision Radiance tokens.
- `src/index.css` — Tailwind layers, Manrope + Material Symbols, scrollbar.
- `src/lib/types.ts` — shared TS types (`Project`).
- `src/api/client.ts` — fetch helpers + endpoints.
- `src/components/Sidebar.tsx`, `TopBar.tsx`, `StatusBar.tsx`, `AppShell.tsx`.
- `src/pages/ProjectsDashboard.tsx`.
- `src/App.tsx`, `src/main.tsx` (QueryClientProvider).
- `src/test/setup.ts`, `src/components/__tests__/Sidebar.test.tsx`, `src/pages/__tests__/ProjectsDashboard.test.tsx`.

---

## Task 1: Backend scaffold + health endpoint

**Files:**
- Create: `backend/pyproject.toml`, `backend/app/__init__.py`, `backend/app/main.py`, `backend/tests/conftest.py`, `backend/tests/test_health.py`

- [ ] **Step 1: Create `backend/pyproject.toml`**

```toml
[project]
name = "modelroom-backend"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.110",
    "uvicorn[standard]>=0.29",
    "sqlmodel>=0.0.16",
    "httpx>=0.27",
]

[project.optional-dependencies]
dev = ["pytest>=8.0"]

[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]
```

- [ ] **Step 2: Create the virtualenv and install**

Run (from `backend/`):
```bash
python -m venv .venv
.venv/Scripts/python -m pip install -e ".[dev]"
```
Expected: installs FastAPI, SQLModel, pytest without errors.

- [ ] **Step 3: Create `backend/app/__init__.py`** (empty file)

```python
```

- [ ] **Step 4: Write the failing test `backend/tests/test_health.py`**

```python
def test_health_returns_ok(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}
```

- [ ] **Step 5: Write `backend/tests/conftest.py`**

```python
import pytest
from fastapi.testclient import TestClient
from app.main import create_app


@pytest.fixture
def client():
    app = create_app()
    with TestClient(app) as c:
        yield c
```

- [ ] **Step 6: Run the test to verify it fails**

Run (from `backend/`): `.venv/Scripts/python -m pytest tests/test_health.py -v`
Expected: FAIL — `ImportError`/`ModuleNotFoundError` for `app.main`.

- [ ] **Step 7: Write minimal `backend/app/main.py`**

```python
from fastapi import FastAPI


def create_app() -> FastAPI:
    app = FastAPI(title="ModelRoom", version="0.1.0")

    @app.get("/health")
    def health():
        return {"status": "ok"}

    return app


app = create_app()
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_health.py -v`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add backend/pyproject.toml backend/app backend/tests
git commit -m "feat(backend): scaffold FastAPI app with health endpoint"
```

---

## Task 2: Config + database layer

**Files:**
- Create: `backend/app/config.py`, `backend/app/db.py`
- Test: `backend/tests/test_config.py`

- [ ] **Step 1: Write the failing test `backend/tests/test_config.py`**

```python
from pathlib import Path
from app.config import Settings


def test_workspace_dir_defaults_under_home():
    s = Settings()
    assert s.workspace_dir == Path.home() / ".modelroom"


def test_workspace_dir_env_override(monkeypatch, tmp_path):
    monkeypatch.setenv("MODELROOM_WORKSPACE", str(tmp_path))
    s = Settings()
    assert s.workspace_dir == tmp_path
    assert s.db_path == tmp_path / "modelroom.db"
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_config.py -v`
Expected: FAIL — no module `app.config`.

- [ ] **Step 3: Write `backend/app/config.py`**

```python
import os
from pathlib import Path


class Settings:
    def __init__(self) -> None:
        env = os.environ.get("MODELROOM_WORKSPACE")
        self.workspace_dir: Path = Path(env) if env else Path.home() / ".modelroom"

    @property
    def db_path(self) -> Path:
        return self.workspace_dir / "modelroom.db"

    @property
    def datasets_dir(self) -> Path:
        return self.workspace_dir / "datasets"

    @property
    def runs_dir(self) -> Path:
        return self.workspace_dir / "runs"

    @property
    def models_dir(self) -> Path:
        return self.workspace_dir / "models"

    def ensure_dirs(self) -> None:
        for p in (self.workspace_dir, self.datasets_dir, self.runs_dir, self.models_dir):
            p.mkdir(parents=True, exist_ok=True)


def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 4: Run to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_config.py -v`
Expected: PASS.

- [ ] **Step 5: Write `backend/app/db.py`**

```python
from collections.abc import Iterator

from sqlmodel import Session, SQLModel, create_engine

from app.config import Settings, get_settings

_engine = None


def get_engine(settings: Settings | None = None):
    global _engine
    if _engine is None:
        settings = settings or get_settings()
        settings.ensure_dirs()
        _engine = create_engine(
            f"sqlite:///{settings.db_path}",
            connect_args={"check_same_thread": False},
        )
    return _engine


def set_engine(engine) -> None:
    global _engine
    _engine = engine


def init_db() -> None:
    SQLModel.metadata.create_all(get_engine())


def get_session() -> Iterator[Session]:
    with Session(get_engine()) as session:
        yield session
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/config.py backend/app/db.py backend/tests/test_config.py
git commit -m "feat(backend): add settings and SQLModel database layer"
```

---

## Task 3: Project model + schemas

**Files:**
- Create: `backend/app/models.py`, `backend/app/schemas.py`
- Test: `backend/tests/test_models.py`

- [ ] **Step 1: Write the failing test `backend/tests/test_models.py`**

```python
from datetime import datetime
from app.models import Project


def test_project_defaults():
    p = Project(name="Churn")
    assert p.name == "Churn"
    assert p.id is None
    assert isinstance(p.created_at, datetime)
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_models.py -v`
Expected: FAIL — no module `app.models`.

- [ ] **Step 3: Write `backend/app/models.py`**

```python
from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Project(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    description: str = ""
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)
```

- [ ] **Step 4: Write `backend/app/schemas.py`**

```python
from datetime import datetime

from pydantic import BaseModel


class ProjectCreate(BaseModel):
    name: str
    description: str = ""


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class ProjectRead(BaseModel):
    id: int
    name: str
    description: str
    created_at: datetime
    updated_at: datetime
```

- [ ] **Step 5: Run to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_models.py -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/models.py backend/app/schemas.py backend/tests/test_models.py
git commit -m "feat(backend): add Project model and schemas"
```

---

## Task 4: Projects CRUD router

**Files:**
- Create: `backend/app/routers/__init__.py`, `backend/app/routers/projects.py`
- Modify: `backend/app/main.py`, `backend/tests/conftest.py`
- Test: `backend/tests/test_projects.py`

- [ ] **Step 1: Update `backend/tests/conftest.py` to isolate the DB per test**

```python
import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine

from app import db
from app.main import create_app


@pytest.fixture
def client(tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path/'test.db'}",
        connect_args={"check_same_thread": False},
    )
    db.set_engine(engine)
    SQLModel.metadata.create_all(engine)
    app = create_app()
    with TestClient(app) as c:
        yield c
    db.set_engine(None)
```

- [ ] **Step 2: Write the failing test `backend/tests/test_projects.py`**

```python
def test_create_and_list_project(client):
    res = client.post("/api/projects", json={"name": "Churn", "description": "tabular"})
    assert res.status_code == 201
    created = res.json()
    assert created["id"] > 0
    assert created["name"] == "Churn"

    res = client.get("/api/projects")
    assert res.status_code == 200
    assert [p["name"] for p in res.json()] == ["Churn"]


def test_get_update_delete_project(client):
    pid = client.post("/api/projects", json={"name": "A"}).json()["id"]

    assert client.get(f"/api/projects/{pid}").json()["name"] == "A"

    res = client.patch(f"/api/projects/{pid}", json={"name": "B"})
    assert res.status_code == 200
    assert res.json()["name"] == "B"

    assert client.delete(f"/api/projects/{pid}").status_code == 204
    assert client.get(f"/api/projects/{pid}").status_code == 404
```

- [ ] **Step 3: Run to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_projects.py -v`
Expected: FAIL — 404 (routes not registered).

- [ ] **Step 4: Create `backend/app/routers/__init__.py`** (empty file)

```python
```

- [ ] **Step 5: Write `backend/app/routers/projects.py`**

```python
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.db import get_session
from app.models import Project
from app.schemas import ProjectCreate, ProjectRead, ProjectUpdate

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(body: ProjectCreate, session: Session = Depends(get_session)):
    project = Project(name=body.name, description=body.description)
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


@router.get("", response_model=list[ProjectRead])
def list_projects(session: Session = Depends(get_session)):
    return session.exec(select(Project).order_by(Project.created_at.desc())).all()


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(project_id: int, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.patch("/{project_id}", response_model=ProjectRead)
def update_project(
    project_id: int, body: ProjectUpdate, session: Session = Depends(get_session)
):
    project = session.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    data = body.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(project, key, value)
    project.updated_at = datetime.now(timezone.utc)
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: int, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    session.delete(project)
    session.commit()
```

- [ ] **Step 6: Update `backend/app/main.py` to wire the router, CORS, and startup**

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import init_db
from app.routers import projects


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="ModelRoom", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health():
        return {"status": "ok"}

    app.include_router(projects.router)
    return app


app = create_app()
```

- [ ] **Step 7: Run the full backend suite**

Run: `.venv/Scripts/python -m pytest -v`
Expected: all tests PASS (health, config, models, projects).

- [ ] **Step 8: Commit**

```bash
git add backend/app/routers backend/app/main.py backend/tests/conftest.py backend/tests/test_projects.py
git commit -m "feat(backend): add Projects CRUD API"
```

---

## Task 5: Frontend scaffold + Tailwind tokens

**Files:**
- Create: `frontend/` Vite scaffold, `frontend/tailwind.config.js`, `frontend/postcss.config.js`, `frontend/src/index.css`

- [ ] **Step 1: Scaffold the Vite app**

Run (from repo root):
```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install -D tailwindcss postcss autoprefixer
npm install @tanstack/react-query
```

- [ ] **Step 2: Create `frontend/postcss.config.js`**

```js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

- [ ] **Step 3: Create `frontend/tailwind.config.js` from Precision Radiance tokens**

Mirror `design_idea/precision_radiance/DESIGN.md`. Colors and spacing copied from `design_idea/projects_dashboard_light/code.html`.

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#fbf9f8",
        surface: "#fbf9f8",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f5f3f3",
        "surface-container": "#efeded",
        "surface-container-high": "#e9e8e7",
        "surface-container-highest": "#e4e2e2",
        "surface-variant": "#e4e2e2",
        "surface-dim": "#dbdad9",
        "on-surface": "#1b1c1c",
        "on-surface-variant": "#57423d",
        "on-background": "#1b1c1c",
        outline: "#8b716b",
        "outline-variant": "#dec0b9",
        primary: "#a63b21",
        "on-primary": "#ffffff",
        "primary-container": "#e86b4d",
        "on-primary-container": "#560d00",
        secondary: "#5f5e5e",
        "secondary-container": "#e5e2e1",
        tertiary: "#5d5e60",
        error: "#ba1a1a",
        "on-error": "#ffffff",
        "error-container": "#ffdad6",
        "on-error-container": "#93000a",
        "inverse-surface": "#303031",
      },
      borderRadius: { DEFAULT: "0.25rem", lg: "0.5rem", xl: "0.75rem", full: "9999px" },
      spacing: {
        base: "4px", xs: "8px", sm: "16px", md: "24px", lg: "32px", xl: "48px",
        gutter: "24px",
      },
      fontFamily: { sans: ["Manrope", "system-ui", "sans-serif"] },
      fontSize: {
        "display-lg": ["48px", { lineHeight: "56px", letterSpacing: "-0.02em", fontWeight: "600" }],
        "headline-lg": ["32px", { lineHeight: "40px", letterSpacing: "-0.01em", fontWeight: "600" }],
        "headline-md": ["24px", { lineHeight: "32px", fontWeight: "600" }],
        "headline-sm": ["18px", { lineHeight: "24px", fontWeight: "600" }],
        "body-lg": ["18px", { lineHeight: "28px" }],
        "body-md": ["16px", { lineHeight: "24px" }],
        "body-sm": ["14px", { lineHeight: "20px" }],
        "label-md": ["14px", { lineHeight: "16px", letterSpacing: "0.05em", fontWeight: "600" }],
        "label-sm": ["12px", { lineHeight: "14px", fontWeight: "500" }],
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 4: Replace `frontend/src/index.css`**

```css
@import url("https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap");
@import url("https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap");

@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-background text-on-background antialiased;
  font-family: "Manrope", system-ui, sans-serif;
}

.material-symbols-outlined { font-variation-settings: "FILL" 0, "wght" 400, "GRAD" 0, "opsz" 24; }
.fill-icon { font-variation-settings: "FILL" 1, "wght" 400, "GRAD" 0, "opsz" 24; }

::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: #fbf9f8; }
::-webkit-scrollbar-thumb { background: #e4e2e2; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: #dec0b9; }
```

- [ ] **Step 5: Verify the dev build compiles**

Run (from `frontend/`): `npm run build`
Expected: build succeeds (Tailwind config valid, no type errors).

- [ ] **Step 6: Commit**

```bash
git add frontend
git commit -m "feat(frontend): scaffold Vite app with Precision Radiance Tailwind tokens"
```

---

## Task 6: API client + types + React Query provider

**Files:**
- Create: `frontend/src/lib/types.ts`, `frontend/src/api/client.ts`
- Modify: `frontend/src/main.tsx`, `frontend/vite.config.ts`

- [ ] **Step 1: Create `frontend/src/lib/types.ts`**

```ts
export interface Project {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Create `frontend/src/api/client.ts`**

```ts
import type { Project } from "../lib/types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const api = {
  listProjects: () => request<Project[]>("/projects"),
  createProject: (body: { name: string; description?: string }) =>
    request<Project>("/projects", { method: "POST", body: JSON.stringify(body) }),
  deleteProject: (id: number) =>
    request<void>(`/projects/${id}`, { method: "DELETE" }),
};
```

- [ ] **Step 3: Add the dev proxy in `frontend/vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/api": "http://localhost:8000" },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  },
});
```

- [ ] **Step 4: Install test deps**

Run (from `frontend/`):
```bash
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 5: Create `frontend/src/test/setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 6: Wrap the app in `frontend/src/main.tsx`**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
```

- [ ] **Step 7: Add the test script to `frontend/package.json`**

Add to `"scripts"`: `"test": "vitest run"`.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/lib frontend/src/api frontend/vite.config.ts frontend/src/main.tsx frontend/src/test frontend/package.json frontend/package-lock.json
git commit -m "feat(frontend): add API client, types, React Query, and dev proxy"
```

---

## Task 7: App shell (Sidebar, TopBar, StatusBar)

**Files:**
- Create: `frontend/src/components/Sidebar.tsx`, `TopBar.tsx`, `StatusBar.tsx`, `AppShell.tsx`
- Test: `frontend/src/components/__tests__/Sidebar.test.tsx`

Mirror the markup in `design_idea/projects_dashboard_light/code.html` (sidebar lines 220–262, topbar 266–296, footer 431–444).

- [ ] **Step 1: Write the failing test `frontend/src/components/__tests__/Sidebar.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { Sidebar } from "../Sidebar";

test("renders all nav items with Projects active", () => {
  render(<Sidebar active="Projects" />);
  for (const label of ["Projects", "Datasets", "Models", "Jobs"]) {
    expect(screen.getByText(label)).toBeInTheDocument();
  }
  expect(screen.getByText("Projects").closest("a")).toHaveClass("bg-primary-container");
});
```

- [ ] **Step 2: Run to verify it fails**

Run (from `frontend/`): `npm test -- Sidebar`
Expected: FAIL — cannot resolve `../Sidebar`.

- [ ] **Step 3: Create `frontend/src/components/Sidebar.tsx`**

```tsx
const NAV = [
  { label: "Projects", icon: "folder_open" },
  { label: "Datasets", icon: "database" },
  { label: "Models", icon: "psychology" },
  { label: "Jobs", icon: "format_list_bulleted" },
] as const;

export function Sidebar({ active }: { active: string }) {
  return (
    <nav className="bg-surface-container-low fixed left-0 top-0 h-full w-[280px] border-r border-outline-variant flex flex-col py-lg px-md gap-sm z-50">
      <div className="mb-lg px-sm">
        <h1 className="text-headline-sm font-bold text-primary">ModelRoom</h1>
        <p className="text-label-sm text-on-surface-variant mt-xs">v0.1.0</p>
      </div>
      <ul className="flex flex-col gap-xs flex-1">
        {NAV.map(({ label, icon }) => {
          const isActive = label === active;
          return (
            <li key={label}>
              <a
                href="#"
                className={
                  "flex items-center gap-sm px-sm py-2 rounded-lg font-medium transition-colors duration-200 " +
                  (isActive
                    ? "bg-primary-container text-on-primary-container"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50")
                }
              >
                <span className={"material-symbols-outlined text-[20px]" + (isActive ? " fill-icon" : "")}>
                  {icon}
                </span>
                {label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- Sidebar`
Expected: PASS.

- [ ] **Step 5: Create `frontend/src/components/TopBar.tsx`**

```tsx
export function TopBar({ title }: { title: string }) {
  return (
    <header className="bg-surface fixed top-0 right-0 w-[calc(100%-280px)] h-16 border-b border-outline-variant flex justify-between items-center px-lg z-40 shadow-sm">
      <nav className="flex h-full items-end">
        <ul className="flex gap-lg h-full">
          <li className="h-full flex items-end">
            <span className="text-primary font-bold border-b-2 border-primary pb-1 uppercase text-label-sm">
              {title}
            </span>
          </li>
        </ul>
      </nav>
      <div className="flex items-center gap-sm">
        <button className="px-5 py-1.5 border border-outline-variant text-on-surface hover:bg-surface-variant/50 rounded-full uppercase font-semibold text-label-sm shadow-sm">
          Export
        </button>
        <button className="px-5 py-1.5 bg-primary text-on-primary font-bold rounded-full uppercase text-label-sm shadow-sm hover:brightness-110">
          Deploy
        </button>
      </div>
    </header>
  );
}
```

- [ ] **Step 6: Create `frontend/src/components/StatusBar.tsx`**

```tsx
export function StatusBar() {
  return (
    <footer className="bg-surface-container-lowest fixed bottom-0 right-0 w-[calc(100%-280px)] h-8 border-t border-outline-variant flex items-center justify-between px-md z-40 text-label-sm">
      <div className="text-on-surface-variant truncate text-[11px] flex items-center gap-2 font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
        Environment: detecting devices…
      </div>
      <div className="flex items-center gap-md text-[11px] font-medium">
        <a href="#" className="text-on-surface-variant hover:text-primary">Documentation</a>
        <a href="#" className="text-on-surface-variant hover:text-primary">System Status</a>
      </div>
    </footer>
  );
}
```

- [ ] **Step 7: Create `frontend/src/components/AppShell.tsx`**

```tsx
import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { StatusBar } from "./StatusBar";

export function AppShell({
  active,
  title,
  children,
}: {
  active: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar active={active} />
      <div className="ml-[280px] w-[calc(100%-280px)] h-full flex flex-col relative">
        <TopBar title={title} />
        <main className="flex-1 overflow-y-auto mt-16 mb-8 p-lg bg-background">{children}</main>
        <StatusBar />
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components
git commit -m "feat(frontend): add Precision Radiance app shell (sidebar, topbar, statusbar)"
```

---

## Task 8: Projects dashboard page

**Files:**
- Create: `frontend/src/pages/ProjectsDashboard.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/pages/__tests__/ProjectsDashboard.test.tsx`

Mirror the dashboard grid + project card in `design_idea/projects_dashboard_light/code.html` (lines 298–428).

- [ ] **Step 1: Write the failing test `frontend/src/pages/__tests__/ProjectsDashboard.test.tsx`**

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProjectsDashboard } from "../ProjectsDashboard";
import { api } from "../../api/client";
import { vi } from "vitest";

vi.mock("../../api/client", () => ({
  api: {
    listProjects: vi.fn().mockResolvedValue([
      { id: 1, name: "Churn", description: "tabular", created_at: "", updated_at: "" },
    ]),
    createProject: vi.fn(),
    deleteProject: vi.fn(),
  },
}));

function renderPage() {
  const qc = new QueryClient();
  render(
    <QueryClientProvider client={qc}>
      <ProjectsDashboard />
    </QueryClientProvider>
  );
}

test("lists projects from the API", async () => {
  renderPage();
  await waitFor(() => expect(screen.getByText("Churn")).toBeInTheDocument());
  expect(api.listProjects).toHaveBeenCalled();
});

test("shows the create-new card", async () => {
  renderPage();
  expect(screen.getByText("Initialize New Workspace")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- ProjectsDashboard`
Expected: FAIL — cannot resolve `../ProjectsDashboard`.

- [ ] **Step 3: Create `frontend/src/pages/ProjectsDashboard.tsx`**

```tsx
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Project } from "../lib/types";

function ProjectCard({ project }: { project: Project }) {
  return (
    <article className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md flex flex-col gap-sm hover:border-outline hover:shadow-md shadow-sm transition-all cursor-pointer group min-h-[200px]">
      <div className="flex justify-between items-start border-b border-outline-variant pb-sm mb-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-primary-container" />
            <h3 className="text-headline-sm text-on-surface group-hover:text-primary font-bold">{project.name}</h3>
          </div>
          <p className="text-label-sm text-on-surface-variant text-[11px]">ID: proj_{project.id}</p>
        </div>
      </div>
      <p className="text-body-sm text-on-surface-variant">{project.description || "No description"}</p>
    </article>
  );
}

export function ProjectsDashboard() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: api.listProjects });
  const create = useMutation({
    mutationFn: () => api.createProject({ name }),
    onSuccess: () => {
      setName("");
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  return (
    <>
      <div className="flex items-center justify-between gap-md mb-lg">
        <div>
          <h2 className="text-headline-md text-on-surface">Active Experiments</h2>
          <p className="text-body-sm text-on-surface-variant mt-xs">
            Overview of current training runs and project statuses.
          </p>
        </div>
        <form
          className="flex items-center gap-sm"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate();
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New project name"
            className="bg-surface border border-outline-variant rounded px-3 py-2 text-body-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-2 bg-primary text-on-primary rounded-full shadow-sm hover:brightness-110 font-semibold text-body-sm whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>New Project
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-md">
        {projects.map((p) => (
          <ProjectCard key={p.id} project={p} />
        ))}
        <div
          onClick={() => name.trim() && create.mutate()}
          className="bg-surface-container-lowest border border-dashed border-outline-variant rounded-lg p-md flex flex-col items-center justify-center gap-sm text-on-surface-variant hover:border-primary hover:text-primary transition-all cursor-pointer min-h-[200px]"
        >
          <span className="material-symbols-outlined text-4xl mb-2">add_circle</span>
          <span className="text-headline-sm font-bold">Initialize New Workspace</span>
          <span className="text-body-sm text-center max-w-[200px]">
            Start an empty project or clone from registry.
          </span>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- ProjectsDashboard`
Expected: PASS.

- [ ] **Step 5: Wire `frontend/src/App.tsx`**

```tsx
import { AppShell } from "./components/AppShell";
import { ProjectsDashboard } from "./pages/ProjectsDashboard";

export default function App() {
  return (
    <AppShell active="Projects" title="Projects">
      <ProjectsDashboard />
    </AppShell>
  );
}
```

- [ ] **Step 6: Run the full frontend suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages frontend/src/App.tsx
git commit -m "feat(frontend): add Projects dashboard wired to the API"
```

---

## Task 9: End-to-end smoke verification + run docs

**Files:**
- Create: `README.md` is NOT created (per project rules). Instead create `backend/run.md` and `frontend/run.md` only if absent — skip; use commands below directly.

- [ ] **Step 1: Start the backend**

Run (from `backend/`): `.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000`
Expected: server starts; `GET http://localhost:8000/health` returns `{"status":"ok"}`.

- [ ] **Step 2: Start the frontend (separate terminal)**

Run (from `frontend/`): `npm run dev`
Expected: Vite serves on `http://localhost:5173`.

- [ ] **Step 3: Manually verify the flow**

In the browser at `http://localhost:5173`:
- The shell renders (coral "ModelRoom" sidebar, top bar, status bar) matching `design_idea/projects_dashboard_light/screen.png`.
- Type a name, click "New Project" → a card appears.
- Reload → the project persists (served from SQLite via the API).

- [ ] **Step 4: Run both test suites a final time**

Run: `cd backend && .venv/Scripts/python -m pytest -q` then `cd ../frontend && npm test`
Expected: all green.

- [ ] **Step 5: Commit any final fixes**

```bash
git add -A
git commit -m "chore: phase 1 foundation end-to-end verified"
```

---

## Self-Review Notes (against the spec)

- **Storage (SQLite + workspace dir):** Tasks 2–3 (config dirs, engine, `Project` table). Other tables (`Dataset`, `ModelDef`, `SavedModel`, `Run`, `RunMetric`, `Checkpoint`) are added in their respective later phases — intentionally out of Phase 1.
- **App shell + design system:** Tasks 5, 7 — tokens from `precision_radiance/DESIGN.md`, shell from `projects_dashboard_light/code.html`.
- **Projects management:** Tasks 4, 8 (API + dashboard).
- **Deferred to later phases (by design):** datasets, preprocessing, model builder, training/jobs/checkpointing, visualizations, model registry, interpretation. Each is its own phase plan.
- **CPU-only / no GPU code in Phase 1:** correct — device/training work begins in Phase 5.
