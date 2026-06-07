import { render, screen } from "@testing-library/react";
import { Sidebar } from "../Sidebar";

test("renders all nav items with Projects active", () => {
  render(<Sidebar active="Projects" />);
  for (const label of ["Projects", "Datasets", "Models", "Jobs"]) {
    expect(screen.getByText(label)).toBeInTheDocument();
  }
  expect(screen.getByText("Projects").closest("a")).toHaveClass("bg-primary-container");
});
