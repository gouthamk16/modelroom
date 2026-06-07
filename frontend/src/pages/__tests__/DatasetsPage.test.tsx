import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";
import { DatasetsPage } from "../DatasetsPage";
import { api } from "../../api/client";

vi.mock("../../api/client", () => ({
  api: {
    listProjects: vi.fn().mockResolvedValue([
      { id: 1, name: "P", description: "", created_at: "", updated_at: "" },
    ]),
    listDatasets: vi.fn().mockResolvedValue([
      {
        id: 5,
        project_id: 1,
        name: "churn.csv",
        filename: "churn.csv",
        n_rows: 10,
        n_cols: 3,
        size_bytes: 100,
        created_at: "",
      },
    ]),
    uploadDataset: vi.fn(),
    datasetSchema: vi.fn().mockResolvedValue([]),
    datasetPreview: vi.fn().mockResolvedValue({ columns: [], rows: [] }),
    datasetCorrelation: vi.fn().mockResolvedValue({ columns: [], matrix: [] }),
    datasetHistogram: vi.fn().mockResolvedValue({ kind: "categorical", bars: [] }),
  },
}));

function renderPage() {
  const qc = new QueryClient();
  render(
    <QueryClientProvider client={qc}>
      <DatasetsPage />
    </QueryClientProvider>
  );
}

test("lists datasets", async () => {
  renderPage();
  await waitFor(() => expect(screen.getByText("churn.csv")).toBeInTheDocument());
  expect(api.listDatasets).toHaveBeenCalled();
});

test("shows the upload control", async () => {
  renderPage();
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Upload CSV" })).toBeInTheDocument()
  );
});
