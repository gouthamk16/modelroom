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
  const datasetsUsed = new Set(
    models.map((m) => m.dataset_id).filter((id): id is number => id != null)
  ).size;

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
        <Stat label="Training runs" value="0" hint="after training (Phase 5)" />
        <Stat label="GPU hours" value="—" hint="after training (Phase 5)" />
        <Stat label="Best model" value="—" hint="needs a completed run" />
        <Stat label="Best accuracy" value="—" hint="needs a completed run" />
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
