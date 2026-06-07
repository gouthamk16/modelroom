import { defineConfig, devices } from "@playwright/test";

// Drives the real app. Backend (127.0.0.1:8000) and frontend (localhost:5173)
// must be running; start them with an isolated MODELROOM_WORKSPACE before running.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    screenshot: "on",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
