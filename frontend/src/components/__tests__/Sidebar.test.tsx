import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { Sidebar } from "../Sidebar";

test("renders all nav items with Projects active", () => {
  render(<Sidebar active="Projects" onNavigate={() => {}} />);
  for (const label of ["Projects", "Datasets", "Models", "Jobs"]) {
    expect(screen.getByText(label)).toBeInTheDocument();
  }
  expect(screen.getByText("Projects").closest("a")).toHaveClass("bg-primary-container");
});

test("calls onNavigate when a nav item is clicked", async () => {
  const onNavigate = vi.fn();
  render(<Sidebar active="Projects" onNavigate={onNavigate} />);
  await userEvent.click(screen.getByText("Datasets"));
  expect(onNavigate).toHaveBeenCalledWith("Datasets");
});
