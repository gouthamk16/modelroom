export interface Project {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface Dataset {
  id: number;
  project_id: number;
  name: string;
  filename: string;
  n_rows: number;
  n_cols: number;
  size_bytes: number;
  created_at: string;
}

export interface SchemaColumn {
  name: string;
  dtype: string;
  kind: "numeric" | "categorical";
  n_null: number;
  n_unique: number;
}

export interface Preview {
  columns: string[];
  rows: Record<string, unknown>[];
}

export interface Histogram {
  kind: "numeric" | "categorical";
  bins?: { start: number; end: number; count: number }[];
  bars?: { value: string; count: number }[];
}

export interface Correlation {
  columns: string[];
  matrix: number[][];
}

export interface PipelineStep {
  type: string;
  params: Record<string, unknown>;
}

export interface PipelineSpec {
  target: string;
  steps: PipelineStep[];
  train_ratio: number;
  val_ratio: number;
  seed: number;
}

export interface PreparationSummary {
  task: "classification" | "regression";
  n_features: number;
  n_classes: number;
  classes: string[];
  splits: { train: number; val: number; test: number };
  target_distribution?: Record<string, number>;
}

export type LayerType =
  | "input"
  | "linear"
  | "relu"
  | "dropout"
  | "batchnorm1d"
  | "output";

export interface GraphNode {
  id: string;
  type: LayerType;
  params: Record<string, number>;
}

export interface ModelGraph {
  nodes: GraphNode[];
  input_features: number | null;
}

export interface ShapeReport {
  valid: boolean;
  total_params: number;
  nodes: { id: string; out_shape: number[]; n_params: number; error: string | null }[];
  errors: string[];
}
