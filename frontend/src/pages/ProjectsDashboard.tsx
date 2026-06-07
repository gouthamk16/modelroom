import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Project } from "../lib/types";

function ProjectCard({ project }: { project: Project }) {
  return (
    <article className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md flex flex-col gap-sm hover:border-outline hover:shadow-md shadow-sm transition-all cursor-pointer group min-h-[200px]">
      <div className="flex justify-between items-start border-b border-outline-variant pb-sm mb-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-primary-container" />
            <h3 className="text-headline-sm text-on-surface group-hover:text-primary font-bold">
              {project.name}
            </h3>
          </div>
          <p className="text-label-sm text-on-surface-variant text-[11px]">ID: proj_{project.id}</p>
        </div>
      </div>
      <p className="text-body-sm text-on-surface-variant">
        {project.description || "No description"}
      </p>
    </article>
  );
}

export function ProjectsDashboard() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: api.listProjects,
  });
  const create = useMutation({
    mutationFn: () => api.createProject({ name }),
    onSuccess: () => {
      setName("");
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  return (
    <>
      <div className="flex items-center justify-between gap-md mb-lg">
        <div>
          <h2 className="text-headline-md text-on-surface">Active Experiments</h2>
          <p className="text-body-sm text-on-surface-variant mt-xs">
            Overview of current training runs and project statuses.
          </p>
        </div>
        <form
          className="flex items-center gap-sm"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate();
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New project name"
            className="bg-surface border border-outline-variant rounded px-3 py-2 text-body-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-2 bg-primary text-on-primary rounded-full shadow-sm hover:brightness-110 font-semibold text-body-sm whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>New Project
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-md">
        {projects.map((p) => (
          <ProjectCard key={p.id} project={p} />
        ))}
        <div
          onClick={() => name.trim() && create.mutate()}
          className="bg-surface-container-lowest border border-dashed border-outline-variant rounded-lg p-md flex flex-col items-center justify-center gap-sm text-on-surface-variant hover:border-primary hover:text-primary transition-all cursor-pointer min-h-[200px]"
        >
          <span className="material-symbols-outlined text-4xl mb-2">add_circle</span>
          <span className="text-headline-sm font-bold">Initialize New Workspace</span>
          <span className="text-body-sm text-center max-w-[200px]">
            Start an empty project or clone from registry.
          </span>
        </div>
      </div>
    </>
  );
}
