import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { PropertiesPanel } from "../PropertiesPanel";
import type { SelectedLayer } from "../PropertiesPanel";

const linear: SelectedLayer = { id: "l1", type: "linear", params: { out_features: 16 } };

test("edits a numeric param and reports change", () => {
  const onChange = vi.fn();
  render(<PropertiesPanel node={linear} onChange={onChange} onRemove={() => {}} />);
  fireEvent.change(screen.getByLabelText("out_features"), { target: { value: "32" } });
  expect(onChange).toHaveBeenCalledWith("l1", { out_features: 32 });
});

test("shows a message when nothing is selected", () => {
  render(<PropertiesPanel node={null} onChange={() => {}} onRemove={() => {}} />);
  expect(screen.getByText(/select a layer/i)).toBeInTheDocument();
});
