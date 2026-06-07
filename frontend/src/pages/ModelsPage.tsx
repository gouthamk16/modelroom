import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { ModelSummary } from "../lib/types";
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
    queryKey: ["datasets", effectiveProject],
    queryFn: () => api.listDatasets(effectiveProject ?? undefined),
    enabled: effectiveProject != null,
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

  const datasetName = (id: number | null) =>
    id == null ? undefined : datasets.find((d) => d.id === id)?.name;

  // keep selected dataset valid for the chosen project
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
            Pick a project, choose a training dataset, and design a model.
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
        <div className="text-body-md text-on-surface-variant">
          Create a project first (Projects tab), then come back to build models.
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-md">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md flex flex-col gap-sm h-fit">
            <h3 className="text-headline-sm font-bold text-on-surface">New model</h3>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Model name"
              className="bg-surface border border-outline-variant rounded-lg px-4 py-2.5 text-body-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <label className="text-label-md uppercase text-on-surface-variant">Training dataset</label>
            <select
              value={datasetId ?? ""}
              onChange={(e) => setDatasetId(e.target.value ? Number(e.target.value) : null)}
              className="bg-surface border border-outline-variant rounded-lg px-4 py-2.5 text-body-sm"
            >
              <option value="">None (choose later)</option>
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <button
              disabled={!name.trim() || create.isPending}
              onClick={() => create.mutate()}
              className="btn-primary px-6 py-2.5 text-body-sm mt-xs"
            >
              Create model
            </button>
          </div>

          <div className="flex flex-col gap-sm">
            {models.length === 0 ? (
              <div className="text-body-md text-on-surface-variant py-lg">
                No models in this project yet. Name one on the left to start.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-md">
                {models.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setOpenModel(m)}
                    className="group text-left bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-primary/40"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-headline-sm font-bold text-on-surface group-hover:text-primary transition-colors">
                        {m.name}
                      </h4>
                      <span className="material-symbols-outlined text-[18px] text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity">
                        arrow_outward
                      </span>
                    </div>
                    <p className="text-label-sm text-on-surface-variant mt-xs">
                      {(m.graph?.nodes?.length ?? 0)} layers ·{" "}
                      {datasetName(m.dataset_id) ?? "no dataset"}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
