const NAV = [
  { label: "Projects", icon: "folder_open" },
  { label: "Datasets", icon: "database" },
  { label: "Models", icon: "psychology" },
  { label: "Jobs", icon: "format_list_bulleted" },
] as const;

export function Sidebar({ active }: { active: string }) {
  return (
    <nav className="bg-surface-container-low fixed left-0 top-0 h-full w-[280px] border-r border-outline-variant flex flex-col py-lg px-md gap-sm z-50">
      <div className="mb-lg px-sm">
        <h1 className="text-headline-sm font-bold text-primary">ModelRoom</h1>
        <p className="text-label-sm text-on-surface-variant mt-xs">v0.1.0</p>
      </div>
      <ul className="flex flex-col gap-xs flex-1">
        {NAV.map(({ label, icon }) => {
          const isActive = label === active;
          return (
            <li key={label}>
              <a
                href="#"
                className={
                  "flex items-center gap-sm px-sm py-2 rounded-lg font-medium transition-colors duration-200 " +
                  (isActive
                    ? "bg-primary-container text-on-primary-container"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50")
                }
              >
                <span
                  className={
                    "material-symbols-outlined text-[20px]" + (isActive ? " fill-icon" : "")
                  }
                >
                  {icon}
                </span>
                {label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
