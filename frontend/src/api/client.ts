import type {
  Project,
  Dataset,
  SchemaColumn,
  Preview,
  Histogram,
  Correlation,
  PipelineSpec,
  PreparationSummary,
  ModelGraph,
  ShapeReport,
  ModelSummary,
  Device,
} from "../lib/types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const api = {
  listProjects: () => request<Project[]>("/projects"),
  getProject: (id: number) => request<Project>(`/projects/${id}`),
  createProject: (body: { name: string; description?: string }) =>
    request<Project>("/projects", { method: "POST", body: JSON.stringify(body) }),
  deleteProject: (id: number) =>
    request<void>(`/projects/${id}`, { method: "DELETE" }),

  listDatasets: () => request<Dataset[]>(`/datasets`),
  uploadDataset: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/datasets`, { method: "POST", body: form });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return (await res.json()) as Dataset;
  },
  datasetSchema: (id: number) => request<SchemaColumn[]>(`/datasets/${id}/schema`),
  datasetPreview: (id: number) => request<Preview>(`/datasets/${id}/preview`),
  datasetHistogram: (id: number, column: string) =>
    request<Histogram>(
      `/datasets/${id}/histogram?column=${encodeURIComponent(column)}`
    ),
  datasetCorrelation: (id: number) =>
    request<Correlation>(`/datasets/${id}/correlation`),

  savePipeline: (datasetId: number, spec: PipelineSpec) =>
    request<{ id: number; target: string }>(`/datasets/${datasetId}/pipeline`, {
      method: "PUT",
      body: JSON.stringify(spec),
    }),
  applyPipeline: (datasetId: number) =>
    request<PreparationSummary>(`/datasets/${datasetId}/pipeline/apply`, {
      method: "POST",
    }),

  validateModel: (graph: ModelGraph) =>
    request<ShapeReport>(`/model/validate`, {
      method: "POST",
      body: JSON.stringify(graph),
    }),
  listModels: (projectId: number) =>
    request<ModelSummary[]>(`/projects/${projectId}/models`),
  createModel: (projectId: number, body: { name: string; dataset_id: number | null }) =>
    request<ModelSummary>(`/projects/${projectId}/models`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getModel: (modelId: number) => request<ModelSummary>(`/models/${modelId}`),
  updateModel: (
    modelId: number,
    body: { name?: string; dataset_id?: number | null; graph?: ModelGraph }
  ) =>
    request<ModelSummary>(`/models/${modelId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  listDevices: () => request<Device[]>(`/system/devices`),
};
