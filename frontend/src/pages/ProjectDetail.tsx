import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md">
      <div className="text-label-md uppercase text-on-surface-variant">{label}</div>
      <div className="text-headline-md text-on-surface mt-xs">{value}</div>
      {hint && <div className="text-label-sm text-on-surface-variant mt-1">{hint}</div>}
    </div>
  );
}

export function ProjectDetail({
  projectId,
  onBack,
}: {
  projectId: number;
  onBack: () => void;
}) {
  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => api.getProject(projectId),
  });
  const { data: models = [] } = useQuery({
    queryKey: ["models", projectId],
    queryFn: () => api.listModels(projectId),
  });
  const { data: runs = [] } = useQuery({
    queryKey: ["runs", projectId],
    queryFn: () => api.listRuns(projectId),
  });
  const datasetsUsed = new Set(
    models.map((m) => m.dataset_id).filter((id): id is number => id != null)
  ).size;

  const best = runs
    .filter((r) => r.summary.best_val_acc != null)
    .sort((a, b) => (b.summary.best_val_acc ?? 0) - (a.summary.best_val_acc ?? 0))[0];
  const bestModelName = best ? models.find((m) => m.id === best.model_id)?.name : undefined;
  const gpuHours =
    runs.reduce((sum, r) => {
      if (!r.started_at || !r.finished_at) return sum;
      return sum + (new Date(r.finished_at).getTime() - new Date(r.started_at).getTime());
    }, 0) /
    3_600_000;

  return (
    <>
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-body-sm text-on-surface-variant hover:text-primary transition-colors mb-sm"
      >
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Projects
      </button>

      <div className="mb-lg">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-primary-container" />
          <h2 className="text-headline-lg text-on-surface">{project?.name ?? "Project"}</h2>
        </div>
        <p className="text-body-md text-on-surface-variant mt-xs">
          {project?.description || "No description yet."}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-md mb-lg">
        <Stat label="Models" value={String(models.length)} />
        <Stat label="Datasets used" value={String(datasetsUsed)} />
        <Stat label="Training runs" value={String(runs.length)} />
        <Stat label="GPU hours" value={gpuHours > 0 ? gpuHours.toFixed(2) : "—"} />
        <Stat label="Best model" value={bestModelName ?? "—"} hint={best ? `run #${best.id}` : "needs a run"} />
        <Stat
          label="Best accuracy"
          value={best?.summary.best_val_acc != null ? best.summary.best_val_acc.toFixed(4) : "—"}
        />
        <Stat
          label="Created"
          value={
            project?.created_at
              ? new Date(project.created_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "—"
          }
        />
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md">
        <h3 className="text-headline-sm font-bold text-on-surface mb-sm">Models</h3>
        {models.length === 0 ? (
          <p className="text-body-sm text-on-surface-variant">No models yet.</p>
        ) : (
          <ul className="flex flex-col gap-xs">
            {models.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between border border-outline-variant rounded-lg px-3 py-2 text-body-sm"
              >
                <span className="text-on-surface font-medium">{m.name}</span>
                <span className="text-on-surface-variant text-label-sm">
                  {m.graph?.nodes?.length ?? 0} layers
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
