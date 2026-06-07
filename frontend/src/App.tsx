import { AppShell } from "./components/AppShell";
import { ProjectsDashboard } from "./pages/ProjectsDashboard";

export default function App() {
  return (
    <AppShell active="Projects" title="Projects">
      <ProjectsDashboard />
    </AppShell>
  );
}
