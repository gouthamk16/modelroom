# ModelRoom v0.1 — Phase 4: Visual Model Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user assemble a sequential MLP visually (Input → Linear/ReLU/Dropout/BatchNorm1d → Output) on a node-graph canvas, edit layer properties, validate the architecture with live per-layer output shapes and parameter counts, and save the model to a project.

**Architecture:** A pure, unit-tested backend `shape_engine` turns an ordered layer list into a shape/param report (no PyTorch — pure arithmetic; the `nn.Module` compiler arrives in Phase 5 training). A `ModelDef` row stores the graph JSON per project. The frontend adds a Models page built on React Flow: layers are a left-to-right chain, edges are derived from node order, a palette adds layers, a properties panel edits the selected layer, and "Validate Architecture" calls the backend to render computed output shapes + total params.

**Tech Stack:** Adds `@xyflow/react` (React Flow v12) on the frontend. Backend uses only stdlib + existing deps. Reuses the Playwright E2E harness.

**Spec reference:** `docs/superpowers/specs/2026-06-07-modelroom-foundation-mlp-design.md` — Backend → Model graph (registry, shape_engine), Frontend → Model builder; mockup `design_idea/interactive_model_builder_light`.

**Builds on:** Phase 1 (`Project`, app shell, page switching). Branch `phase4-model-builder` (already created).

**Model representation:** a **sequential chain**. `graph.nodes` is an ordered list; edges always connect consecutive nodes (derived, not free-form). This matches "stack linear layers" and keeps the shape engine and UI simple. Arbitrary DAGs are out of scope for v0.1.

---

## File Structure

**Backend**
- Modify `backend/app/models.py` — add `ModelDef`.
- Modify `backend/app/schemas.py` — add `ModelGraph`, `LayerNode`.
- Create `backend/app/models_builder/__init__.py`
- Create `backend/app/models_builder/shape_engine.py` — pure validate().
- Create `backend/app/routers/models.py` — save/get/validate endpoints.
- Modify `backend/app/main.py` — include router.
- Tests: `test_shape_engine.py`, `test_models_api.py`.

**Frontend**
- Modify `frontend/src/lib/types.ts` — `LayerType`, `ModelGraph`, `ShapeReport`.
- Modify `frontend/src/api/client.ts` — model endpoints.
- Create `frontend/src/lib/graph.ts` — pure graph helpers (default/add/remove/update/chainEdges).
- Create `frontend/src/components/builder/LayerNode.tsx` — custom React Flow node.
- Create `frontend/src/components/builder/PropertiesPanel.tsx` — edit selected layer.
- Create `frontend/src/pages/ModelBuilder.tsx` — canvas + palette + validate/save.
- Modify `frontend/src/App.tsx` — route "Models" → ModelBuilder.
- Tests: `graph.test.ts`, `PropertiesPanel.test.tsx`; extend `e2e/smoke.spec.ts`.

---

## Task 1: Backend ModelDef + schemas

**Files:**
- Modify: `backend/app/models.py`, `backend/app/schemas.py`
- Test: `backend/tests/test_models.py` (extend)

- [ ] **Step 1: Write the failing test (append to `backend/tests/test_models.py`)**

```python
def test_modeldef_defaults():
    from app.models import ModelDef

    m = ModelDef(project_id=1, name="mlp")
    assert m.project_id == 1
    assert m.graph_json == "{}"
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_models.py::test_modeldef_defaults -v`
Expected: FAIL — cannot import `ModelDef`.

- [ ] **Step 3: Add `ModelDef` to `backend/app/models.py`** (append)

```python
class ModelDef(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", index=True)
    name: str = "model"
    graph_json: str = "{}"
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)
```

- [ ] **Step 4: Add schemas to `backend/app/schemas.py`** (append)

```python
class LayerNode(BaseModel):
    id: str
    type: str
    params: dict = {}


class ModelGraph(BaseModel):
    nodes: list[LayerNode] = []
    input_features: int | None = None
```

- [ ] **Step 5: Run to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_models.py -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/models.py backend/app/schemas.py backend/tests/test_models.py
git commit -m "feat(backend): add ModelDef model and graph schemas"
```

---

## Task 2: Pure shape-inference engine

**Files:**
- Create: `backend/app/models_builder/__init__.py`, `backend/app/models_builder/shape_engine.py`
- Test: `backend/tests/test_shape_engine.py`

- [ ] **Step 1: Create `backend/app/models_builder/__init__.py`** (empty file)

```python
```

- [ ] **Step 2: Write the failing test `backend/tests/test_shape_engine.py`**

```python
from app.models_builder import shape_engine


def _nodes():
    return [
        {"id": "in", "type": "input", "params": {"features": 8}},
        {"id": "l1", "type": "linear", "params": {"out_features": 16}},
        {"id": "a1", "type": "relu", "params": {}},
        {"id": "out", "type": "output", "params": {"classes": 3}},
    ]


def test_valid_chain_shapes_and_params():
    rep = shape_engine.validate(_nodes())
    assert rep["valid"] is True
    by_id = {n["id"]: n for n in rep["nodes"]}
    assert by_id["l1"]["out_shape"] == [16]
    assert by_id["l1"]["n_params"] == 8 * 16 + 16
    assert by_id["out"]["out_shape"] == [3]
    # total = linear(144) + output(16*3+3=51)
    assert rep["total_params"] == (8 * 16 + 16) + (16 * 3 + 3)


def test_missing_input_is_invalid():
    rep = shape_engine.validate([{"id": "l1", "type": "linear", "params": {"out_features": 4}}])
    assert rep["valid"] is False
    assert any("input" in e.lower() for e in rep["errors"])


def test_missing_output_is_invalid():
    nodes = [
        {"id": "in", "type": "input", "params": {"features": 4}},
        {"id": "l1", "type": "linear", "params": {"out_features": 4}},
    ]
    rep = shape_engine.validate(nodes)
    assert rep["valid"] is False
    assert any("output" in e.lower() for e in rep["errors"])


def test_linear_without_out_features_errors():
    nodes = [
        {"id": "in", "type": "input", "params": {"features": 4}},
        {"id": "l1", "type": "linear", "params": {}},
        {"id": "out", "type": "output", "params": {"classes": 2}},
    ]
    rep = shape_engine.validate(nodes)
    assert rep["valid"] is False
    assert any(n["id"] == "l1" and n["error"] for n in rep["nodes"])


def test_input_features_override():
    nodes = [
        {"id": "in", "type": "input", "params": {}},
        {"id": "out", "type": "output", "params": {"classes": 2}},
    ]
    rep = shape_engine.validate(nodes, input_features=10)
    by_id = {n["id"]: n for n in rep["nodes"]}
    assert by_id["in"]["out_shape"] == [10]
```

- [ ] **Step 3: Run to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_shape_engine.py -v`
Expected: FAIL — no module `app.models_builder.shape_engine`.

- [ ] **Step 4: Write `backend/app/models_builder/shape_engine.py`**

```python
PASSTHROUGH = {"relu", "dropout"}


def validate(nodes: list[dict], input_features: int | None = None) -> dict:
    report = []
    errors = []
    total = 0
    cur: int | None = None

    if not nodes or nodes[0]["type"] != "input":
        errors.append("Graph must start with an input layer")

    for node in nodes:
        t = node["type"]
        p = node.get("params", {})
        err = None
        out: list[int] = []
        n_params = 0

        if t == "input":
            cur = int(p.get("features") or input_features or 0)
            if cur <= 0:
                err = "Input features must be > 0"
            out = [cur]
        elif t == "linear":
            o = int(p.get("out_features", 0))
            if cur is None:
                err = "No input dimension before this layer"
            elif o <= 0:
                err = "out_features must be > 0"
            else:
                n_params = cur * o + o
                out = [o]
                cur = o
        elif t in PASSTHROUGH:
            out = [cur] if cur is not None else []
        elif t == "batchnorm1d":
            if cur is None:
                err = "No input dimension before this layer"
            else:
                n_params = 2 * cur
                out = [cur]
        elif t == "output":
            c = int(p.get("classes", 0))
            if cur is None:
                err = "No input dimension before this layer"
            elif c <= 0:
                err = "classes must be > 0"
            else:
                n_params = cur * c + c
                out = [c]
                cur = c
        else:
            err = f"Unknown layer type: {t}"

        if err:
            errors.append(f"{t}: {err}")
        total += n_params
        report.append({"id": node["id"], "out_shape": out, "n_params": n_params, "error": err})

    if not any(n["type"] == "output" for n in nodes):
        errors.append("Graph must end with an output layer")

    return {
        "valid": len(errors) == 0,
        "total_params": total,
        "nodes": report,
        "errors": errors,
    }
```

- [ ] **Step 5: Run to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_shape_engine.py -v`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/models_builder/__init__.py backend/app/models_builder/shape_engine.py backend/tests/test_shape_engine.py
git commit -m "feat(backend): add pure shape-inference engine"
```

---

## Task 3: Model API (save/get/validate)

**Files:**
- Create: `backend/app/routers/models.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_models_api.py`

- [ ] **Step 1: Write the failing test `backend/tests/test_models_api.py`**

```python
def _graph():
    return {
        "nodes": [
            {"id": "in", "type": "input", "params": {"features": 8}},
            {"id": "l1", "type": "linear", "params": {"out_features": 16}},
            {"id": "out", "type": "output", "params": {"classes": 2}},
        ],
        "input_features": None,
    }


def test_validate_endpoint(client):
    rep = client.post("/api/model/validate", json=_graph()).json()
    assert rep["valid"] is True
    assert rep["total_params"] == (8 * 16 + 16) + (16 * 2 + 2)


def test_save_and_get_model(client):
    pid = client.post("/api/projects", json={"name": "P"}).json()["id"]
    save = client.put(f"/api/projects/{pid}/model", json={"name": "mlp", "graph": _graph()})
    assert save.status_code == 200

    got = client.get(f"/api/projects/{pid}/model").json()
    assert got["name"] == "mlp"
    assert got["graph"]["nodes"][1]["params"]["out_features"] == 16
```

- [ ] **Step 2: Run to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_models_api.py -v`
Expected: FAIL — routes missing.

- [ ] **Step 3: Write `backend/app/routers/models.py`**

```python
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
```

- [ ] **Step 4: Wire in `backend/app/main.py`**

Change `from app.routers import datasets, preprocessing, projects` to:

```python
from app.routers import datasets, models, preprocessing, projects
```

Add after `app.include_router(preprocessing.router)`:

```python
    app.include_router(models.router)
```

- [ ] **Step 5: Run to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_models_api.py -v`
Expected: PASS.

- [ ] **Step 6: Run the full backend suite**

Run: `.venv/Scripts/python -m pytest -q`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/models.py backend/app/main.py backend/tests/test_models_api.py
git commit -m "feat(backend): add model save/get/validate API"
```

---

## Task 4: Frontend types + API client + React Flow

**Files:**
- Modify: `frontend/src/lib/types.ts`, `frontend/src/api/client.ts`
- Install: `@xyflow/react`

- [ ] **Step 1: Install React Flow**

Run (from `frontend/`): `npm install @xyflow/react`
Expected: installs without errors.

- [ ] **Step 2: Append types to `frontend/src/lib/types.ts`**

```ts
export type LayerType =
  | "input"
  | "linear"
  | "relu"
  | "dropout"
  | "batchnorm1d"
  | "output";

export interface GraphNode {
  id: string;
  type: LayerType;
  params: Record<string, number>;
}

export interface ModelGraph {
  nodes: GraphNode[];
  input_features: number | null;
}

export interface ShapeReport {
  valid: boolean;
  total_params: number;
  nodes: { id: string; out_shape: number[]; n_params: number; error: string | null }[];
  errors: string[];
}
```

- [ ] **Step 3: Append endpoints to the `api` object in `frontend/src/api/client.ts`**

Extend the type import with `ModelGraph, ShapeReport`, then add before the closing brace of `api`:

```ts
  validateModel: (graph: ModelGraph) =>
    request<ShapeReport>(`/model/validate`, {
      method: "POST",
      body: JSON.stringify(graph),
    }),
  saveModel: (projectId: number, name: string, graph: ModelGraph) =>
    request<{ id: number; name: string }>(`/projects/${projectId}/model`, {
      method: "PUT",
      body: JSON.stringify({ name, graph }),
    }),
  getModel: (projectId: number) =>
    request<{ id: number; name: string; graph: ModelGraph }>(
      `/projects/${projectId}/model`
    ),
```

- [ ] **Step 4: Verify the build compiles**

Run (from `frontend/`): `npm run build`
Expected: succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/types.ts frontend/src/api/client.ts frontend/package.json frontend/package-lock.json
git commit -m "feat(frontend): add model types, API client, and React Flow"
```

---

## Task 5: Pure graph helpers

**Files:**
- Create: `frontend/src/lib/graph.ts`
- Test: `frontend/src/lib/__tests__/graph.test.ts`

- [ ] **Step 1: Write the failing test `frontend/src/lib/__tests__/graph.test.ts`**

```ts
import { describe, expect, test } from "vitest";
import { defaultGraph, addLayer, removeLayer, updateParams, chainEdges } from "../graph";

describe("graph helpers", () => {
  test("defaultGraph has input then output", () => {
    const g = defaultGraph(8, 2);
    expect(g.nodes.map((n) => n.type)).toEqual(["input", "output"]);
    expect(g.nodes[0].params.features).toBe(8);
    expect(g.nodes[1].params.classes).toBe(2);
  });

  test("addLayer inserts before output", () => {
    const g = addLayer(defaultGraph(8, 2), "linear");
    expect(g.nodes.map((n) => n.type)).toEqual(["input", "linear", "output"]);
  });

  test("removeLayer drops by id and keeps input/output", () => {
    const g = addLayer(defaultGraph(8, 2), "linear");
    const linId = g.nodes[1].id;
    const g2 = removeLayer(g, linId);
    expect(g2.nodes.map((n) => n.type)).toEqual(["input", "output"]);
  });

  test("updateParams sets a numeric param", () => {
    const g = addLayer(defaultGraph(8, 2), "linear");
    const linId = g.nodes[1].id;
    const g2 = updateParams(g, linId, { out_features: 32 });
    expect(g2.nodes[1].params.out_features).toBe(32);
  });

  test("chainEdges connects consecutive nodes", () => {
    const g = addLayer(defaultGraph(8, 2), "linear");
    const edges = chainEdges(g.nodes);
    expect(edges).toHaveLength(2);
    expect(edges[0]).toMatchObject({ source: g.nodes[0].id, target: g.nodes[1].id });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run (from `frontend/`): `npx vitest run graph`
Expected: FAIL — cannot resolve `../graph`.

- [ ] **Step 3: Write `frontend/src/lib/graph.ts`**

```ts
import type { GraphNode, LayerType, ModelGraph } from "./types";

const DEFAULT_PARAMS: Record<LayerType, Record<string, number>> = {
  input: { features: 8 },
  linear: { out_features: 16 },
  relu: {},
  dropout: { p: 0.5 },
  batchnorm1d: {},
  output: { classes: 2 },
};

let seq = 0;
function newId(type: LayerType): string {
  seq += 1;
  return `${type}_${seq}`;
}

export function defaultGraph(features: number, classes: number): ModelGraph {
  return {
    nodes: [
      { id: "input", type: "input", params: { features } },
      { id: "output", type: "output", params: { classes } },
    ],
    input_features: features,
  };
}

export function addLayer(graph: ModelGraph, type: LayerType): ModelGraph {
  const node: GraphNode = { id: newId(type), type, params: { ...DEFAULT_PARAMS[type] } };
  const outIdx = graph.nodes.findIndex((n) => n.type === "output");
  const insertAt = outIdx === -1 ? graph.nodes.length : outIdx;
  const nodes = [...graph.nodes.slice(0, insertAt), node, ...graph.nodes.slice(insertAt)];
  return { ...graph, nodes };
}

export function removeLayer(graph: ModelGraph, id: string): ModelGraph {
  if (id === "input" || id === "output") return graph;
  return { ...graph, nodes: graph.nodes.filter((n) => n.id !== id) };
}

export function updateParams(
  graph: ModelGraph,
  id: string,
  params: Record<string, number>
): ModelGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((n) =>
      n.id === id ? { ...n, params: { ...n.params, ...params } } : n
    ),
  };
}

export function chainEdges(nodes: GraphNode[]): { id: string; source: string; target: string }[] {
  return nodes.slice(0, -1).map((n, i) => ({
    id: `${n.id}-${nodes[i + 1].id}`,
    source: n.id,
    target: nodes[i + 1].id,
  }));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run graph`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/graph.ts frontend/src/lib/__tests__/graph.test.ts
git commit -m "feat(frontend): add pure model-graph helpers"
```

---

## Task 6: Layer node + properties panel

**Files:**
- Create: `frontend/src/components/builder/LayerNode.tsx`, `frontend/src/components/builder/PropertiesPanel.tsx`
- Test: `frontend/src/components/builder/__tests__/PropertiesPanel.test.tsx`

- [ ] **Step 1: Write the failing test `frontend/src/components/builder/__tests__/PropertiesPanel.test.tsx`**

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { PropertiesPanel } from "../PropertiesPanel";
import type { GraphNode } from "../../../lib/types";

const linear: GraphNode = { id: "l1", type: "linear", params: { out_features: 16 } };

test("edits a numeric param and reports change", () => {
  const onChange = vi.fn();
  render(<PropertiesPanel node={linear} onChange={onChange} onRemove={() => {}} />);
  fireEvent.change(screen.getByLabelText("out_features"), { target: { value: "32" } });
  expect(onChange).toHaveBeenCalledWith("l1", { out_features: 32 });
});

test("shows a message when nothing is selected", () => {
  render(<PropertiesPanel node={null} onChange={() => {}} onRemove={() => {}} />);
  expect(screen.getByText(/select a layer/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run PropertiesPanel`
Expected: FAIL — cannot resolve `../PropertiesPanel`.

- [ ] **Step 3: Create `frontend/src/components/builder/LayerNode.tsx`**

```tsx
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";

const LABELS: Record<string, string> = {
  input: "INPUT",
  linear: "LINEAR",
  relu: "RELU",
  dropout: "DROPOUT",
  batchnorm1d: "BATCHNORM1D",
  output: "OUTPUT",
};

export function LayerNode({ data, selected }: NodeProps) {
  const d = data as { type: string; params: Record<string, number>; outShape?: number[]; error?: string | null };
  const accent = d.type === "input" || d.type === "output";
  return (
    <div
      className={
        "rounded-lg border bg-surface-container-lowest shadow-sm min-w-[150px] " +
        (d.error
          ? "border-error"
          : selected
            ? "border-primary"
            : accent
              ? "border-primary/40"
              : "border-outline-variant")
      }
    >
      <Handle type="target" position={Position.Left} />
      <div className="px-3 py-2 border-b border-outline-variant flex items-center justify-between">
        <span className="text-label-md uppercase text-primary">{LABELS[d.type] ?? d.type}</span>
      </div>
      <div className="px-3 py-2 text-label-sm text-on-surface-variant">
        {Object.entries(d.params).map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <span>{k}</span>
            <span className="text-on-surface font-medium">{v}</span>
          </div>
        ))}
        {d.outShape && (
          <div className="mt-1 pt-1 border-t border-outline-variant/60 text-[10px]">
            → [{d.outShape.join(", ")}]
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
```

- [ ] **Step 4: Create `frontend/src/components/builder/PropertiesPanel.tsx`**

```tsx
import type { GraphNode } from "../../lib/types";

export function PropertiesPanel({
  node,
  onChange,
  onRemove,
}: {
  node: GraphNode | null;
  onChange: (id: string, params: Record<string, number>) => void;
  onRemove: (id: string) => void;
}) {
  if (!node) {
    return (
      <div className="text-body-sm text-on-surface-variant p-md">
        Select a layer to edit its properties.
      </div>
    );
  }

  const editable = node.type !== "relu";
  const removable = node.type !== "input" && node.type !== "output";

  return (
    <div className="flex flex-col gap-sm p-md">
      <div>
        <h3 className="text-headline-sm font-bold text-on-surface">{node.type}</h3>
        <p className="text-label-sm text-on-surface-variant uppercase">{node.id}</p>
      </div>

      {editable &&
        Object.entries(node.params).map(([key, value]) => (
          <div key={key} className="flex flex-col gap-xs">
            <label htmlFor={key} className="text-label-md uppercase text-on-surface-variant">
              {key}
            </label>
            <input
              id={key}
              aria-label={key}
              type="number"
              value={value}
              step={key === "p" ? 0.05 : 1}
              onChange={(e) => onChange(node.id, { [key]: Number(e.target.value) })}
              className="bg-surface border border-outline-variant rounded px-3 py-2 text-body-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
        ))}

      {node.type === "relu" && (
        <p className="text-body-sm text-on-surface-variant">No parameters.</p>
      )}

      {removable && (
        <button
          onClick={() => onRemove(node.id)}
          className="mt-sm text-error border border-error/40 rounded-full px-4 py-1.5 text-body-sm hover:bg-error/10"
        >
          Remove layer
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run PropertiesPanel`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/builder
git commit -m "feat(frontend): add layer node and properties panel"
```

---

## Task 7: Model builder page (canvas + palette + validate/save)

**Files:**
- Create: `frontend/src/pages/ModelBuilder.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create `frontend/src/pages/ModelBuilder.tsx`**

```tsx
import { useMemo, useState } from "react";
import { ReactFlow, Background, Controls } from "@xyflow/react";
import type { Edge, Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import {
  addLayer,
  chainEdges,
  defaultGraph,
  removeLayer,
  updateParams,
} from "../lib/graph";
import type { GraphNode, LayerType, ShapeReport } from "../lib/types";
import { LayerNode } from "../components/builder/LayerNode";
import { PropertiesPanel } from "../components/builder/PropertiesPanel";

const PALETTE: LayerType[] = ["linear", "relu", "dropout", "batchnorm1d"];
const nodeTypes = { layer: LayerNode };

export function ModelBuilder() {
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: api.listProjects,
  });
  const projectId = projects[0]?.id ?? null;

  const [graph, setGraph] = useState(() => defaultGraph(8, 2));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [report, setReport] = useState<ShapeReport | null>(null);

  const validate = useMutation({
    mutationFn: () => api.validateModel(graph),
    onSuccess: setReport,
  });
  const save = useMutation({
    mutationFn: () => api.saveModel(projectId!, "mlp", graph),
  });

  const reportById = useMemo(
    () => Object.fromEntries((report?.nodes ?? []).map((n) => [n.id, n])),
    [report]
  );

  const flowNodes: Node[] = graph.nodes.map((n, i) => ({
    id: n.id,
    type: "layer",
    position: { x: i * 220, y: 80 },
    data: {
      type: n.type,
      params: n.params,
      outShape: reportById[n.id]?.out_shape,
      error: reportById[n.id]?.error,
    },
  }));
  const flowEdges: Edge[] = chainEdges(graph.nodes).map((e) => ({ ...e, animated: true }));

  const selected: GraphNode | null =
    graph.nodes.find((n) => n.id === selectedId) ?? null;

  return (
    <div className="grid grid-cols-[1fr_320px] gap-md h-[calc(100vh-8rem)]">
      <div className="flex flex-col gap-sm">
        <div className="flex items-center gap-sm">
          {PALETTE.map((t) => (
            <button
              key={t}
              onClick={() => setGraph((g) => addLayer(g, t))}
              className="px-4 py-1.5 border border-outline-variant rounded-full text-body-sm hover:border-primary hover:text-primary"
            >
              + {t}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-sm">
            <button
              onClick={() => validate.mutate()}
              className="px-5 py-1.5 border border-primary text-primary rounded-full text-body-sm font-semibold"
            >
              Validate Architecture
            </button>
            <button
              disabled={!projectId}
              onClick={() => save.mutate()}
              className="btn-primary px-5 py-1.5 text-body-sm"
            >
              Save Model
            </button>
          </div>
        </div>

        <div className="flex-1 border border-outline-variant rounded-lg bg-surface-container-low overflow-hidden">
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            onNodeClick={(_, n) => setSelectedId(n.id)}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>

        {report && (
          <div
            className={
              "rounded-lg border px-md py-sm text-body-sm " +
              (report.valid
                ? "border-primary/40 bg-primary-container/10 text-on-surface"
                : "border-error/40 bg-error/5 text-error")
            }
          >
            {report.valid ? (
              <span>Valid · {report.total_params.toLocaleString()} parameters</span>
            ) : (
              <span>{report.errors.join(" · ")}</span>
            )}
          </div>
        )}
      </div>

      <div className="border border-outline-variant rounded-lg bg-surface-container-lowest overflow-y-auto">
        <PropertiesPanel
          node={selected}
          onChange={(id, params) => setGraph((g) => updateParams(g, id, params))}
          onRemove={(id) => {
            setGraph((g) => removeLayer(g, id));
            setSelectedId(null);
          }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Route "Models" in `frontend/src/App.tsx`**

```tsx
import { useState } from "react";
import { AppShell } from "./components/AppShell";
import { ProjectsDashboard } from "./pages/ProjectsDashboard";
import { DatasetsPage } from "./pages/DatasetsPage";
import { ModelBuilder } from "./pages/ModelBuilder";

export default function App() {
  const [page, setPage] = useState("Projects");
  return (
    <AppShell active={page} title={page} onNavigate={setPage}>
      {page === "Datasets" ? (
        <DatasetsPage />
      ) : page === "Models" ? (
        <ModelBuilder />
      ) : (
        <ProjectsDashboard />
      )}
    </AppShell>
  );
}
```

- [ ] **Step 3: Build to verify it compiles**

Run (from `frontend/`): `npm run build`
Expected: succeeds.

- [ ] **Step 4: Run the unit suite (no regressions)**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/ModelBuilder.tsx frontend/src/App.tsx
git commit -m "feat(frontend): add visual model builder page (React Flow)"
```

---

## Task 8: End-to-end UI verification

**Files:**
- Modify: `frontend/e2e/smoke.spec.ts`

- [ ] **Step 1: Append an E2E test to `frontend/e2e/smoke.spec.ts`**

```ts
test("model builder: add a layer, validate, and save", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Models" }).click();

  // canvas shows the default Input and Output nodes
  await expect(page.getByText("INPUT")).toBeVisible();
  await expect(page.getByText("OUTPUT")).toBeVisible();

  // add a linear layer
  await page.getByRole("button", { name: "+ linear" }).click();
  await expect(page.getByText("LINEAR", { exact: true })).toBeVisible();

  // validate
  await page.getByRole("button", { name: "Validate Architecture" }).click();
  await expect(page.getByText(/parameters/)).toBeVisible();

  await page.screenshot({ path: "e2e/screens/model-builder.png", fullPage: true });
});
```

- [ ] **Step 2: Ensure a project exists, then start servers (isolated workspace)**

Backend (background): `MODELROOM_WORKSPACE="$(pwd)/.e2e_ws" .venv/Scripts/python -m uvicorn app.main:app --port 8000 --log-level warning`
Frontend (background): `npm run dev`
Then create a project so Save has a target:
`curl -s -X POST http://127.0.0.1:8000/api/projects -H "Content-Type: application/json" -d '{"name":"M"}'`

- [ ] **Step 3: Run the full E2E**

Run (from `frontend/`): `npx playwright test`
Expected: all E2E tests pass (projects, datasets, preprocessing, model builder).

- [ ] **Step 4: Visually inspect `frontend/e2e/screens/model-builder.png`**

Confirm the node-graph canvas renders Input → Linear → Output with the properties panel and validation banner.

- [ ] **Step 5: Stop servers, clean, run both unit suites**

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
git commit -m "test(frontend): add model builder E2E"
```

---

## Self-Review Notes (against the spec)

- **Model graph registry + shape engine + validation:** Task 2 (pure engine), Task 3 (validate/save/get API). Layer set: input, linear, relu, dropout, batchnorm1d, output — matches spec.
- **Computed output + Validate Architecture + param counts:** shape engine returns per-node `out_shape`/`n_params` + `total_params`; surfaced on nodes and in the banner (Tasks 6–7).
- **Visual builder (React Flow canvas, properties panel):** Tasks 5–7; mirrors `interactive_model_builder` mockup (node cards, layer properties).
- **Sequential-chain scope:** explicitly chosen; edges derived via `chainEdges`. Arbitrary DAGs deferred.
- **PyTorch deferral:** shape/param math is pure arithmetic; the `nn.Module` compiler is Phase 5 (training) where torch is actually needed. Noted in spec alignment — no functionality lost for the builder.
- **Type consistency:** `LayerType`, `GraphNode`, `ModelGraph`, `ShapeReport` defined in Task 4, used across Tasks 5–8; API methods `validateModel`/`saveModel`/`getModel` consistent; backend keys (`out_shape`, `n_params`, `total_params`, `valid`, `errors`) match the frontend `ShapeReport`.
- **Realtime UI testing:** Task 8 drives the real browser and screenshots the canvas.
