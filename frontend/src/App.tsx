import { useState } from "react";
import { AppShell } from "./components/AppShell";
import { ProjectsDashboard } from "./pages/ProjectsDashboard";
import { DatasetsPage } from "./pages/DatasetsPage";

export default function App() {
  const [page, setPage] = useState("Projects");
  return (
    <AppShell active={page} title={page} onNavigate={setPage}>
      {page === "Datasets" ? <DatasetsPage /> : <ProjectsDashboard />}
    </AppShell>
  );
}
