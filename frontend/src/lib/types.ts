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
