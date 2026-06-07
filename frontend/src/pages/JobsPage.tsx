import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { RunView } from "../components/training/RunView";
import { RunCompare } from "../components/training/RunCompare";

const STATUS_STYLE: Record<string, string> = {
  running: "bg-primary-container/20 text-primary",
  paused: "bg-surface-variant text-on-surface-variant",
  completed: "bg-primary-container/20 text-primary",
  failed: "bg-error/10 text-error",
  stopped: "bg-surface-variant text-on-surface-variant",
  queued: "bg-surface-variant text-on-surface-variant",
};

export function JobsPage() {
  const [projectId, setProjectId] = useState<number | null>(null);
  const [openRun, setOpenRun] = useState<number | null>(null);
  const [compare, setCompare] = useState<number[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: api.listProjects });
  const effectiveProject = projectId ?? projects[0]?.id ?? null;

  const { data: runs = [] } = useQuery({
    queryKey: ["runs", effectiveProject],
    queryFn: () => api.listRuns(effectiveProject!),
    enabled: effectiveProject != null,
    refetchInterval: 2000,
  });

  if (openRun !== null) return <RunView runId={openRun} onBack={() => setOpenRun(null)} />;
  if (compare !== null) return <RunCompare runIds={compare} onClose={() => setCompare(null)} />;

  const toggle = (id: number) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-md mb-lg">
        <div>
          <h2 className="text-headline-lg text-on-surface">Jobs</h2>
          <p className="text-body-md text-on-surface-variant mt-xs">
            Training runs — open one live, or select runs to compare.
          </p>
        </div>
        <div className="flex items-center gap-sm">
          {selected.size >= 2 && (
            <button
              onClick={() => setCompare([...selected])}
              className="btn-primary px-5 py-2.5 text-body-sm"
            >
              Compare {selected.size}
            </button>
          )}
          <label className="flex items-center gap-sm text-label-md uppercase text-on-surface-variant">
            Project
            <select
              value={effectiveProject ?? ""}
              onChange={(e) => setProjectId(Number(e.target.value))}
              className="bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-2.5 text-body-sm normal-case text-on-surface"
            >
              {projects.length === 0 && <option value="">No projects yet</option>}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {runs.length === 0 ? (
        <EmptyState
          icon="timeline"
          title="No training runs yet"
          description="Open a model and press Train to start a run — it'll show up here."
        />
      ) : (
        <table className="w-full text-body-sm border border-outline-variant rounded-lg bg-surface-container-lowest overflow-hidden">
          <thead>
            <tr className="border-b border-outline-variant text-on-surface-variant text-label-sm uppercase">
              <th className="px-3 py-2 w-8"></th>
              <th className="text-left px-3 py-2">Run</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Epochs</th>
              <th className="text-left px-3 py-2">Best val acc</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="border-b border-outline-variant/50">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    className="accent-[#a63b21]"
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                  />
                </td>
                <td className="px-3 py-2 font-medium text-on-surface">#{r.id}</td>
                <td className="px-3 py-2">
                  <span
                    className={
                      "px-2 py-0.5 rounded-full text-label-sm uppercase " +
                      (STATUS_STYLE[r.status] ?? "")
                    }
                  >
                    {r.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-on-surface-variant">
                  {r.last_epoch}/{r.config.epochs}
                </td>
                <td className="px-3 py-2 text-on-surface">
                  {r.summary.best_val_acc != null ? r.summary.best_val_acc.toFixed(4) : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => setOpenRun(r.id)}
                    className="text-primary hover:underline text-body-sm"
                  >
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
