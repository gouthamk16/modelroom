import { test, expect } from "@playwright/test";

const CSV = "age,income,city\n20,3000,NY\n30,5000,LA\n40,7000,NY\n50,9000,SF\n";

test("projects: create a project and see its card", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Projects", level: 2 })).toBeVisible();

  const name = `E2E Project ${Date.now()}`;
  await page.getByPlaceholder("Name a new project").fill(name);
  await page.getByRole("button", { name: "New Project" }).click();

  await expect(page.getByText(name)).toBeVisible();
  await page.screenshot({ path: "e2e/screens/projects.png", fullPage: true });
});

test("datasets: upload a CSV and see preview + visualizations", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Datasets" }).click();
  await expect(page.getByRole("heading", { name: "Import Dataset" })).toBeVisible();

  await page.setInputFiles('input[type="file"]', {
    name: "mr.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(CSV),
  });
  await page.getByRole("button", { name: "Upload CSV" }).click();

  // dataset appears in the list and is auto-selected
  await expect(page.getByText("mr.csv")).toBeVisible();
  // preview header cell
  await expect(page.getByRole("cell", { name: "NY" }).first()).toBeVisible();
  // correlation heatmap section
  await expect(page.getByRole("heading", { name: "Correlation" })).toBeVisible();

  await page.screenshot({ path: "e2e/screens/datasets.png", fullPage: true });
});

test("preprocessing: build a pipeline and apply it", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Datasets" }).click();

  await page.setInputFiles('input[type="file"]', {
    name: "prep.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "age,city,label\n" +
        Array.from({ length: 20 }, (_, i) =>
          `${20 + i},${i % 2 ? "NY" : "LA"},${i % 3 ? "yes" : "no"}`
        ).join("\n") +
        "\n"
    ),
  });
  await page.getByRole("button", { name: "Upload CSV" }).click();
  await page.getByText("prep.csv").click();

  await expect(page.getByRole("heading", { name: "Data Processing" })).toBeVisible();
  await page.getByLabel("Target").selectOption("label");
  await page.getByLabel("Add step").selectOption("standardize");
  await page.getByLabel("Add step").selectOption("one_hot");
  await page.getByRole("button", { name: "Apply Pipeline" }).click();

  await expect(page.getByText(/classification/)).toBeVisible();
  await expect(page.getByText(/train/)).toBeVisible();
  await page.screenshot({ path: "e2e/screens/preprocessing.png", fullPage: true });
});

test("model builder: validate starter, add a node, get validation feedback", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Models" }).click();

  await expect(page.getByText("INPUT")).toBeVisible();
  await expect(page.getByText("OUTPUT")).toBeVisible();

  // starter input -> output is a valid graph
  await page.getByRole("button", { name: "Validate Architecture" }).click();
  await expect(page.getByText(/parameters/)).toBeVisible();

  // adding a disconnected layer should be flagged on next validation
  await page.getByRole("button", { name: "+ linear" }).click();
  await expect(page.getByText("LINEAR", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Validate Architecture" }).click();
  await expect(page.getByText(/not connected/i)).toBeVisible();

  await page.screenshot({ path: "e2e/screens/model-builder.png", fullPage: true });
});
