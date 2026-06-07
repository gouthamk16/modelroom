import { useState } from "react";
import { AppShell } from "./components/AppShell";
import { ProjectsDashboard } from "./pages/ProjectsDashboard";
import { ProjectDetail } from "./pages/ProjectDetail";
import { DatasetsPage } from "./pages/DatasetsPage";
import { ModelsPage } from "./pages/ModelsPage";

type Route = { name: string; projectId?: number };

export default function App() {
  const [route, setRoute] = useState<Route>({ name: "Projects" });
  const active = route.name === "ProjectDetail" ? "Projects" : route.name;

  return (
    <AppShell active={active} title={active} onNavigate={(name) => setRoute({ name })}>
      {route.name === "Datasets" ? (
        <DatasetsPage />
      ) : route.name === "Models" ? (
        <ModelsPage />
      ) : route.name === "ProjectDetail" && route.projectId != null ? (
        <ProjectDetail
          projectId={route.projectId}
          onBack={() => setRoute({ name: "Projects" })}
        />
      ) : (
        <ProjectsDashboard
          onOpenProject={(id) => setRoute({ name: "ProjectDetail", projectId: id })}
        />
      )}
    </AppShell>
  );
}
