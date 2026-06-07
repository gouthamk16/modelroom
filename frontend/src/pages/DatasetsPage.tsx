import { useRef, useState } from "react";
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
  align = "start",
}: {
  onUpload: (file: File) => void;
  pending: boolean;
  align?: "start" | "center";
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className={"flex flex-col gap-sm " + (align === "center" ? "items-center" : "items-start")}>
      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.target.value = "";
        }}
      />
      <button
        disabled={pending}
        onClick={() => fileRef.current?.click()}
        className="btn-primary px-5 py-2 text-body-sm whitespace-nowrap"
      >
        Upload CSV
      </button>
    </div>
  );
}

export function DatasetsPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);

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

  const upload = useMutation({
    mutationFn: (file: File) => api.uploadDataset(file),
    onSuccess: (ds) => {
      qc.invalidateQueries({ queryKey: ["datasets"] });
      setSelectedId(ds.id);
    },
  });

  return (
    <>
      <div className="mb-lg">
        <h2 className="text-headline-lg text-on-surface">Datasets</h2>
        <p className="text-body-md text-on-surface-variant mt-xs">
          Import a CSV to preview, visualize, and preprocess it. Datasets are shared across
          all projects.
        </p>
      </div>

      {datasets.length === 0 ? (
        <EmptyState
          icon="upload_file"
          title="Upload your first dataset"
          description="Add a CSV to preview, visualize, and preprocess it."
        >
          <UploadControl onUpload={(f) => upload.mutate(f)} pending={upload.isPending} align="center" />
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
