import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { ModelSummary } from "../lib/types";
import { EmptyState } from "../components/EmptyState";
import { ModelBuilder } from "./ModelBuilder";

export function ModelsPage() {
  const qc = useQueryClient();
  const [projectId, setProjectId] = useState<number | null>(null);
  const [datasetId, setDatasetId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [openModel, setOpenModel] = useState<ModelSummary | null>(null);

  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: api.listProjects });
  const effectiveProject = projectId ?? projects[0]?.id ?? null;

  const { data: datasets = [] } = useQuery({
    queryKey: ["datasets"],
    queryFn: () => api.listDatasets(),
  });
  const { data: models = [] } = useQuery({
    queryKey: ["models", effectiveProject],
    queryFn: () => api.listModels(effectiveProject!),
    enabled: effectiveProject != null,
  });

  const create = useMutation({
    mutationFn: () =>
      api.createModel(effectiveProject!, { name: name.trim(), dataset_id: datasetId }),
    onSuccess: (model) => {
      setName("");
      qc.invalidateQueries({ queryKey: ["models", effectiveProject] });
      setOpenModel(model);
    },
  });

  const duplicate = useMutation({
    mutationFn: (m: ModelSummary) =>
      api.createModel(effectiveProject!, {
        name: `${m.name} v2`,
        dataset_id: m.dataset_id,
        graph: m.graph,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["models", effectiveProject] }),
  });

  const datasetName = (id: number | null) =>
    id == null ? undefined : datasets.find((d) => d.id === id)?.name;

  useEffect(() => {
    setDatasetId(null);
  }, [effectiveProject]);

  if (openModel) {
    return (
      <ModelBuilder
        model={openModel}
        datasetName={datasetName(openModel.dataset_id)}
        onBack={() => setOpenModel(null)}
      />
    );
  }

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-md mb-lg">
        <div>
          <h2 className="text-headline-lg text-on-surface">Models</h2>
          <p className="text-body-md text-on-surface-variant mt-xs">
            Design networks visually and validate them before training.
          </p>
        </div>
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

      {effectiveProject == null ? (
        <EmptyState
          icon="hub"
          title="No projects yet"
          description="Create a project in the Projects tab to start building models."
        />
      ) : (
        <>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md flex flex-col sm:flex-row sm:items-end gap-sm mb-md">
            <div className="flex-1">
              <label className="text-label-md uppercase text-on-surface-variant">Model name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Model name"
                className="mt-xs w-full bg-surface border border-outline-variant rounded-lg px-4 py-2.5 text-body-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex-1">
              <label className="text-label-md uppercase text-on-surface-variant">Training dataset</label>
              <select
                value={datasetId ?? ""}
                onChange={(e) => setDatasetId(e.target.value ? Number(e.target.value) : null)}
                className="mt-xs w-full bg-surface border border-outline-variant rounded-lg px-4 py-2.5 text-body-sm"
              >
                <option value="">None (choose later)</option>
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              disabled={!name.trim() || create.isPending}
              onClick={() => create.mutate()}
              className="btn-primary px-6 py-2.5 text-body-sm whitespace-nowrap"
            >
              Create model
            </button>
          </div>

          {models.length === 0 ? (
            <EmptyState
              icon="hub"
              title="No models yet"
              description="Name a model above and create it to open the visual builder."
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-md">
              {models.map((m) => (
                <div
                  key={m.id}
                  onClick={() => setOpenModel(m)}
                  className="group cursor-pointer bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-primary/40"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-headline-sm font-bold text-on-surface group-hover:text-primary transition-colors">
                      {m.name}
                    </h4>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicate.mutate(m);
                      }}
                      title="Duplicate as a new version"
                      className="material-symbols-outlined text-[18px] text-on-surface-variant hover:text-primary"
                    >
                      content_copy
                    </button>
                  </div>
                  <p className="text-label-sm text-on-surface-variant mt-xs">
                    {(m.graph?.nodes?.length ?? 0)} layers · {datasetName(m.dataset_id) ?? "no dataset"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
