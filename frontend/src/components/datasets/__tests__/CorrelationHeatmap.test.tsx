import { render, screen } from "@testing-library/react";
import { CorrelationHeatmap } from "../CorrelationHeatmap";

test("renders a cell per matrix entry plus headers", () => {
  render(
    <CorrelationHeatmap
      correlation={{ columns: ["a", "b"], matrix: [[1, 0.5], [0.5, 1]] }}
    />
  );
  expect(screen.getAllByText("a").length).toBeGreaterThanOrEqual(1);
  // symmetric matrix → 0.5 appears in two cells
  expect(screen.getAllByText("0.5")).toHaveLength(2);
});

test("renders nothing when fewer than 2 numeric columns", () => {
  const { container } = render(
    <CorrelationHeatmap correlation={{ columns: ["a"], matrix: [[1]] }} />
  );
  expect(container).toBeEmptyDOMElement();
});
