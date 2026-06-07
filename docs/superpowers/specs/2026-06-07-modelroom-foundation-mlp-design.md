# ModelRoom v0.1 — Foundation + Tabular/MLP Walking Skeleton

**Date:** 2026-06-07
**Status:** Approved design
**Spec owner:** Goutham

## Context

ModelRoom is an interactive, local, single-user studio for building, training, and
analyzing ML/DL models through a UI. The long-term vision spans dataset management,
preprocessing, a visual model builder, training/compute, analysis & explainability,
and HuggingFace integration/finetuning. That full vision is decomposed into
independent subsystems (each gets its own design → plan → build cycle):

| # | Subsystem | Owns | Depends on |
|---|-----------|------|------------|
| 0 | Platform foundation | App shell, projects, storage, job/compute orchestration, design system | — |
| 1 | Dataset management | Import (local + HuggingFace), preview, versioning | 0 |
| 2 | Preprocessing pipeline | Curate/clean/transform (GPU-accelerated later), reproducible steps | 1 |
| 3 | Visual model builder | Drag-drop layer graph, shape inference, validation, codegen | 0 |
| 4 | Training & compute | Device (GPU/multi-GPU) selection, run orchestration, live metrics | 2, 3 |
| 5 | Analysis & explainability | Layer internals, activations, SHAP/attention, analysis dashboards | 4 |
| 6 | HuggingFace + finetuning | Import pretrained models, finetune flows | 1, 4 |

Build order: 0 → 1 → 2/3 → 4 → 5/6.

**This spec covers the first slice only:** the platform foundation plus a thin
tabular/MLP path that goes end-to-end (import → preprocess → build → train on GPU →
view results). It is a *walking skeleton* — it proves the whole architecture so later
model types (CV, classic ML) become "register more types," not new plumbing.

## Decisions (from brainstorming)

- **Deployment:** local, single-user. Compute runs on the user's own machine. No auth,
  no multi-tenancy, no billing.
- **Goal:** a real tool the user will use → optimize for working ML correctness over
  breadth or production hardening.
- **Pace:** solo, wants momentum → thin vertical slice working fast.
- **First domains (overall):** classic ML, classic DL (stacked linear layers), CV.
  This slice ships the **tabular/MLP** path; CV and classic-ML (sklearn) follow as
  slices 2 and 3 on the same foundation.
- **Framework:** PyTorch (+ sklearn later for classic ML).
- **Hardware:** multiple NVIDIA GPUs → multi-GPU device selection is in scope from day one.
- **Stack:** FastAPI + PyTorch backend; React + Vite + Tailwind frontend; SQLite +
  workspace dir; subprocess training jobs; WebSocket live updates.
- **Design system:** `Precision Radiance` (see `design_idea/precision_radiance/DESIGN.md`)
  — Manrope, coral/black on warm neutrals, soft elevated cards.

## Scope

### In scope
- Project management (create/list/select).
- Local CSV import → schema inference, head preview, per-column basic stats.
- Preprocessing pipeline builder: ordered steps (drop-nulls, normalize/standardize,
  one-hot/label-encode, target select, train/val/test split), fit-on-train +
  deterministic apply, fitted state persisted.
- Visual MLP builder: Input → stacked Linear/activation/Dropout/BatchNorm1d → Output,
  with live shape inference and architecture validation.
- Multi-GPU training as managed subprocess jobs.
- **Checkpointing + pause/resume:** periodic + best-val checkpoints; pause a run to a
  graceful checkpoint and resume it later from exactly where it stopped.
- **Model save/load (ModelRoom-native):** save a trained model as an
  architecture-graph + weights bundle under a Models registry; load it back to inspect,
  continue training, or start a new run.
- **Visualizations:** the data / training / evaluation / architecture viz catalog marked
  *v0.1* in the Visualizations section below.
- **Model interpretation (foundational):** architecture graph + layer summary (output
  shapes, param counts, model size), weight/activation distribution histograms, and
  permutation feature importance.
- Live training analytics (loss/metric curves, live console) + persisted run results.

### Out of scope (later cycles)
HuggingFace / external model import; CV/Conv layers + image loaders; sklearn classic-ML
models; cuDF GPU preprocessing; the deep explainability suite (SHAP, LIME, Grad-CAM /
saliency, attention maps, activation maximization, embedding projections — cataloged
below, built in the Analysis & Explainability slice); finetuning *workflows* (the
checkpoint/resume *primitive* they reuse is in scope); ONNX/TorchScript export; deploy;
auth; landing-page polish.

## Architecture

**Shape:** local two-process app. Python FastAPI backend (REST + WebSocket) performs
all ML with PyTorch; React + Vite + Tailwind frontend renders the design and talks over
localhost. Training runs as spawned subprocess jobs so a run can be stopped/killed,
survives a crash, and maps cleanly to per-job GPU assignment.

### Module boundaries (designed for isolation)
- `layer_registry` + `shape_engine` + `compiler` — **pure**: graph JSON in → output
  shapes / `nn.Module` out. No server dependency; unit-testable in isolation.
- `preprocessing` — **pure**: DataFrame in → arrays + fitted transform state out;
  deterministic; fitted state reused across train/val/test.
- `job_manager` — owns subprocess lifecycle (start/stop/kill/status); the training
  script is a standalone entrypoint invoked as a subprocess.
- frontend **builder canvas** — isolated state; communicates only via the model-graph
  JSON contract.

### Backend
- **Storage:** SQLite via SQLModel — `Project`, `Dataset`, `ModelDef`, `SavedModel`,
  `Run`, `RunMetric`, `Checkpoint`. Workspace dir `~/.modelroom/` holds dataset files,
  fitted preprocessors, `runs/<id>/` (checkpoints, logs, metrics), and `models/<id>/`
  (saved architecture-graph + weights bundles).
- **Datasets:** CSV → pandas parse → schema (columns, dtypes), head preview, per-column
  basic stats.
- **Preprocessing:** ordered JSON steps; fit on train split, apply deterministically;
  fitted state saved alongside the dataset.
- **Model graph:** registry of `Input, Linear, ReLU/activations, Dropout, BatchNorm1d,
  Output`. Compiler builds an `nn.Module`. `shape_engine` computes per-layer output
  shapes and validates connectivity/shape compatibility → powers "Validate Architecture"
  and the "Computed Output" panel.
- **Training & jobs:** a run = dataset + preprocessing + model + config (optimizer, lr,
  loss, epochs, batch size, device(s)). Spawned as a subprocess tracked by
  `job_manager`; supports stop/kill; captures crash/OOM (exit code + last logs).
  Multi-GPU selection from the start (`DataParallel` for >1 device; kept simple).
  Run states: `queued → running → (paused) → completed | failed | stopped`.
- **Checkpointing & resume:** a checkpoint bundles model `state_dict`, optimizer state,
  epoch/step, RNG states (torch/numpy/python/cuda), and the active config. Written
  periodically (every N epochs), on best validation metric, and on graceful pause.
  **Pause** signals the subprocess to flush a checkpoint and exit cleanly → state
  `paused`. **Resume** spawns a fresh subprocess that loads the latest checkpoint and
  continues from the saved epoch/step with metric history intact. This is the same
  primitive finetuning will later reuse.
- **Model registry (save/load):** "save model" bundles the architecture graph (JSON) +
  a chosen checkpoint's weights into `models/<id>/` and records a `SavedModel`. "Load
  model" reconstructs the graph in the builder and makes the weights available to
  inspect, continue-train (via resume), or seed a new run. The compiler/`shape_engine`
  guarantee load↔build symmetry. External/HF model import (no native graph) is the
  separate HF slice.
- **Realtime:** per-run WebSocket streaming epoch/step metrics + log lines; a
  system-status channel feeding GPU util/mem (via `pynvml`), RAM, and disk for the
  bottom status bar.

### Frontend
- **Design system:** Tailwind config generated from `Precision Radiance` tokens +
  Manrope; base components (Button, Card, Input, Chip).
- **Shell:** left sidebar (Projects/Datasets/Models/Jobs), top breadcrumb + run/stop,
  bottom status bar.
- **Pages:**
  - Projects dashboard.
  - Datasets — preview + pipeline builder + dataset visualizations.
  - Model builder — React Flow canvas + layer-properties panel + live validation +
    architecture summary (params/shapes/size).
  - Models registry — list/save/load saved models; **inspection view** (architecture
    graph, layer summary, weight/activation distributions, feature importance).
  - Training — device picker, hyperparams, **start / pause / resume / stop**, live
    loss/metric charts (Recharts), live console; checkpoint list with "resume from".
  - Jobs — runs with status (`running/paused/completed/failed/stopped`) and resume.
- **Data:** React Query (REST), a WebSocket hook (live streams), Zustand (canvas state).

## Visualizations (full catalog)

The complete target catalog so nothing is lost. `[v0.1]` ships in this slice; `[later]`
is cataloged now and built in the noted slice. v0.1 items intentionally avoid heavy
dependencies (SHAP/Captum/UMAP) and stick to what the tabular/MLP path produces directly.

**Dataset / data**
- `[v0.1]` Per-column histograms (numerical) and bar charts (categorical).
- `[v0.1]` Summary-stats table (count, min/max, mean, std, % null, cardinality).
- `[v0.1]` Target / class-balance distribution.
- `[v0.1]` Correlation heatmap (numerical features).
- `[v0.1]` Missing-value map.
- `[v0.1]` Before/after-preprocessing distribution comparison.
- `[later]` Pairwise scatter matrix; dimensionality-reduction scatter (PCA/t-SNE/UMAP).

**Model architecture / static interpretation**
- `[v0.1]` Interactive architecture graph (builder + loaded models).
- `[v0.1]` Layer summary table (layer, output shape, param count, % of total).
- `[v0.1]` Totals: parameter count, model size (MB), per-layer breakdown.
- `[v0.1]` Per-layer weight/bias distribution histograms.
- `[later]` Traced computational graph (torchviz-style) for arbitrary loaded models.
- `[later]` FLOPs / MACs estimation.

**Training (live + historical)**
- `[v0.1]` Loss curves (train/val), per epoch and per step.
- `[v0.1]` Metric curves (accuracy / task metric).
- `[v0.1]` Learning-rate schedule curve.
- `[v0.1]` Gradient-norm over time.
- `[v0.1]` Throughput (samples/sec) and epoch time.
- `[v0.1]` GPU util/mem, RAM, disk timelines.
- `[v0.1]` Live console / logs.
- `[v0.1]` Run comparison (overlay curves from multiple runs).
- `[later]` Per-layer weight/gradient/activation histograms *over training time*.

**Evaluation**
- `[v0.1]` Confusion matrix.
- `[v0.1]` Classification report (precision/recall/F1 per class).
- `[v0.1]` ROC + AUC and precision-recall curves.
- `[v0.1]` Per-class accuracy bars; probability-threshold explorer.
- `[v0.1]` Regression: predicted-vs-actual, residual plot, error distribution.
- `[later]` Calibration / reliability curve.

**Interpretability / explainability**
- `[v0.1]` Permutation feature importance (tabular).
- `[v0.1]` Per-layer activation distribution stats on a sample batch.
- `[later — Explainability slice]` SHAP (summary/beeswarm/force/dependence); LIME;
  partial-dependence / ICE; saliency / Integrated Gradients / Grad-CAM (CV); activation
  feature-map visualization; activation maximization / filter visualization; attention
  maps (transformers); embedding projections (t-SNE/UMAP/PCA); layer-wise relevance
  propagation; counterfactuals.

## Data flow (the skeleton path)

project → import CSV → schema/preview/viz → build preprocessing pipeline + select target
→ build MLP (input dim inferred from feature count, output from class count) → validate +
inspect architecture summary → configure training + pick GPU(s) → start run (subprocess)
→ live metrics/logs stream to Training page and persist; periodic/best checkpoints written
→ optionally **pause** (graceful checkpoint) and **resume** later → run completes →
evaluation viz + interpretation available → **save model** to registry → loaded later to
inspect or continue-train.

## Error handling
- CSV parse errors surfaced to the user.
- Architecture/shape errors shown inline in the builder *before* training starts.
- Training subprocess crash/OOM → run marked failed with exit code + last log lines
  (the "Failed at Epoch N / crash trace" state); the last good checkpoint remains
  resumable.
- Pause that fails to checkpoint within a timeout falls back to stop (no corrupt
  checkpoint); resume validates checkpoint↔model-graph compatibility before starting.
- WebSocket disconnects auto-reconnect; on reconnect, persisted metrics are replayed so
  charts rebuild from history.

## Testing
- **Backend (pytest):** unit tests for `shape_engine`, graph→`nn.Module` compiler,
  preprocessing determinism (fit/transform consistency), schema inference; **checkpoint
  round-trip** (save → resume reproduces identical state/continues deterministically);
  **model save/load symmetry** (saved bundle reloads to an equivalent module); metric
  computations (confusion matrix, classification report, permutation importance);
  integration test running a tiny CSV → MLP → train → **pause → resume → finish** on CPU
  writing real metrics; `job_manager` start/stop/pause/resume.
- **Frontend (Vitest + RTL):** component tests for builder validation display, config
  forms, and run controls (start/pause/resume/stop state transitions).
- **CPU path is the CI contract; CUDA/multi-GPU paths are gated behind hardware.**

## Success criteria
A user can, on their own machine: create a project, import a CSV, explore it with the
data visualizations, build a preprocessing pipeline and pick a target, assemble an MLP
with live shape validation and an architecture summary, launch a training run on selected
GPU(s), watch loss/metric curves update live, **pause and later resume** the run, let it
finish, review evaluation and interpretation visualizations, **save the model** to the
registry, and **load it back** to inspect or continue training — all without writing code.
