import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { PreviewTable, SchemaList } from "../components/datasets/DatasetTable";
import { Histogram } from "../components/datasets/Histogram";
import { CorrelationHeatmap } from "../components/datasets/CorrelationHeatmap";
import { ProcessingPanel } from "../components/datasets/ProcessingPanel";

export function DatasetsPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);

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

  const effectiveProject = projectId ?? projects[0]?.id ?? null;

  const upload = useMutation({
    mutationFn: (file: File) => api.uploadDataset(effectiveProject!, file),
    onSuccess: (ds) => {
      qc.invalidateQueries({ queryKey: ["datasets"] });
      setSelectedId(ds.id);
    },
  });

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
            <div className="flex items-center gap-sm">
              <span className="text-label-md uppercase text-on-surface-variant">
                Distribution
              </span>
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
            <ProcessingPanel datasetId={selectedId} columns={schema.map((c) => c.name)} />
          </>
        )}
      </div>
    </div>
  );
}
