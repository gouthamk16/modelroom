import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";
import { ProjectsDashboard } from "../ProjectsDashboard";
import { api } from "../../api/client";

vi.mock("../../api/client", () => ({
  api: {
    listProjects: vi.fn().mockResolvedValue([
      { id: 1, name: "Churn", description: "tabular", created_at: "", updated_at: "" },
    ]),
    createProject: vi.fn(),
    deleteProject: vi.fn(),
  },
}));

function renderPage() {
  const qc = new QueryClient();
  render(
    <QueryClientProvider client={qc}>
      <ProjectsDashboard />
    </QueryClientProvider>
  );
}

test("lists projects from the API", async () => {
  renderPage();
  await waitFor(() => expect(screen.getByText("Churn")).toBeInTheDocument());
  expect(api.listProjects).toHaveBeenCalled();
});

test("shows the create button", () => {
  renderPage();
  expect(screen.getByRole("button", { name: /New Project/ })).toBeInTheDocument();
});
