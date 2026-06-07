import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProcessingPanel } from "../ProcessingPanel";
import { api } from "../../../api/client";

vi.mock("../../../api/client", () => ({
  api: {
    savePipeline: vi.fn().mockResolvedValue({ id: 1, target: "label" }),
    applyPipeline: vi.fn().mockResolvedValue({
      task: "classification",
      n_features: 4,
      n_classes: 2,
      classes: ["no", "yes"],
      splits: { train: 14, val: 3, test: 3 },
      target_distribution: { no: 7, yes: 7 },
    }),
  },
}));

function setup() {
  const qc = new QueryClient();
  render(
    <QueryClientProvider client={qc}>
      <ProcessingPanel datasetId={5} columns={["age", "city", "label"]} />
    </QueryClientProvider>
  );
}

test("adds a step and applies the pipeline", async () => {
  setup();
  await userEvent.selectOptions(screen.getByLabelText("Target"), "label");
  await userEvent.selectOptions(screen.getByLabelText("Add step"), "standardize");
  expect(screen.getByText("1. standardize")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Apply Pipeline" }));
  expect(api.savePipeline).toHaveBeenCalled();
  expect(api.applyPipeline).toHaveBeenCalledWith(5);
  expect(await screen.findByText(/14 train/)).toBeInTheDocument();
});
