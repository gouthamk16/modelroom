import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { PreviewTable, SchemaList } from "../components/datasets/DatasetTable";
import { Histogram } from "../components/datasets/Histogram";
import { CorrelationHeatmap } from "../components/datasets/CorrelationHeatmap";
import { ProcessingPanel } from "../components/datasets/ProcessingPanel";

function UploadControl({
  onUpload,
  pending,
}: {
  onUpload: (file: File) => void;
  pending: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-sm">
      <input ref={fileRef} type="file" accept=".csv" className="text-body-sm max-w-[220px]" />
      <button
        disabled={pending}
        onClick={() => {
          const f = fileRef.current?.files?.[0];
          if (f) onUpload(f);
        }}
        className="btn-primary px-5 py-2 text-body-sm whitespace-nowrap"
      >
        Upload CSV
      </button>
    </div>
  );
}

export function DatasetsPage() {
  const qc = useQueryClient();
  const [projectId, setProjectId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);

  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: api.listProjects });
  const effectiveProject = projectId ?? projects[0]?.id ?? null;

  const { data: datasets = [] } = useQuery({
    queryKey: ["datasets", effectiveProject],
    queryFn: () => api.listDatasets(effectiveProject ?? undefined),
    enabled: effectiveProject != null,
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

  const upload = useMutation({
    mutationFn: (file: File) => api.uploadDataset(effectiveProject!, file),
    onSuccess: (ds) => {
      qc.invalidateQueries({ queryKey: ["datasets", effectiveProject] });
      setSelectedId(ds.id);
    },
  });

  useEffect(() => {
    setSelectedId(null);
  }, [effectiveProject]);

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-md mb-lg">
        <div>
          <h2 className="text-headline-lg text-on-surface">Datasets</h2>
          <p className="text-body-md text-on-surface-variant mt-xs">
            Import a CSV to preview, visualize, and preprocess it.
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
          icon="database"
          title="No projects yet"
          description="Create a project in the Projects tab, then import datasets here."
        />
      ) : datasets.length === 0 ? (
        <EmptyState
          icon="upload_file"
          title="Upload your first dataset"
          description="Add a CSV to this project to preview, visualize, and preprocess it."
        >
          <UploadControl onUpload={(f) => upload.mutate(f)} pending={upload.isPending} />
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-md">
          <div className="flex flex-col gap-md">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md flex flex-col gap-sm">
              <h3 className="text-label-md uppercase text-on-surface-variant">Import dataset</h3>
              <UploadControl onUpload={(f) => upload.mutate(f)} pending={upload.isPending} />
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
              <EmptyState
                icon="bar_chart"
                title="Select a dataset to explore"
                description="Pick a dataset on the left to see its preview, distributions, and correlations."
              />
            ) : (
              <>
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
                <ProcessingPanel datasetId={selectedId} columns={schema.map((c) => c.name)} />
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
