import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Project } from "../lib/types";

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function ProjectCard({ project, onOpen }: { project: Project; onOpen?: () => void }) {
  return (
    <article
      onClick={onOpen}
      className="group relative bg-surface-container-lowest border border-outline-variant rounded-xl p-md flex flex-col gap-sm shadow-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl hover:border-primary/40 cursor-pointer min-h-[180px]"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary-container" />
          <h3 className="text-headline-sm font-bold text-on-surface group-hover:text-primary transition-colors">
            {project.name}
          </h3>
        </div>
        <span className="material-symbols-outlined text-[18px] text-on-surface-variant opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
          arrow_outward
        </span>
      </div>
      <p className="text-body-sm text-on-surface-variant flex-1">
        {project.description || "No description yet."}
      </p>
      <div className="flex items-center justify-between border-t border-outline-variant/60 pt-sm text-label-sm text-on-surface-variant">
        <span className="font-mono text-[11px]">proj_{project.id}</span>
        <span>{formatDate(project.created_at)}</span>
      </div>
    </article>
  );
}

export function ProjectsDashboard({
  onOpenProject,
}: {
  onOpenProject?: (id: number) => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: api.listProjects,
  });
  const create = useMutation({
    mutationFn: () => api.createProject({ name: name.trim() }),
    onSuccess: () => {
      setName("");
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && !create.isPending) create.mutate();
  };

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-md mb-xl">
        <div>
          <h2 className="text-headline-lg text-on-surface">Projects</h2>
          <p className="text-body-md text-on-surface-variant mt-xs">
            Each project holds its datasets, models, and training runs.
          </p>
        </div>
        <form className="flex items-center gap-sm" onSubmit={submit}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name a new project"
            className="bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-2.5 text-body-sm w-64 transition-all focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-outline"
          />
          <button
            type="submit"
            disabled={!name.trim() || create.isPending}
            className="btn-primary flex items-center gap-2 px-6 py-2.5 text-body-sm whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Project
          </button>
        </form>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-24 gap-sm">
          <div className="w-16 h-16 rounded-2xl bg-primary-container/15 flex items-center justify-center mb-xs">
            <span className="material-symbols-outlined text-primary text-[32px]">workspaces</span>
          </div>
          <h3 className="text-headline-sm font-bold text-on-surface">Create your first project</h3>
          <p className="text-body-md text-on-surface-variant max-w-sm">
            Name a project above and press New Project to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-md">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} onOpen={() => onOpenProject?.(p.id)} />
          ))}
        </div>
      )}
    </>
  );
}
