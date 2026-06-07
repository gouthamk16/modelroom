import { useTheme } from "../lib/useTheme";

const NAV = [
  { label: "Projects", icon: "folder_open" },
  { label: "Datasets", icon: "database" },
  { label: "Models", icon: "psychology" },
  { label: "Jobs", icon: "format_list_bulleted" },
] as const;

export function Sidebar({
  active,
  onNavigate,
}: {
  active: string;
  onNavigate: (label: string) => void;
}) {
  const { isDark, toggle } = useTheme();
  return (
    <nav className="bg-surface-container-low fixed left-0 top-0 h-full w-[280px] border-r border-outline-variant flex flex-col py-lg px-md gap-sm z-50">
      <div className="mb-xl px-sm pt-xs">
        <h1 className="logo-font text-[26px] leading-none text-primary-container">ModelRoom</h1>
      </div>
      <ul className="flex flex-col gap-base flex-1">
        {NAV.map(({ label, icon }) => {
          const isActive = label === active;
          return (
            <li key={label}>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(label);
                }}
                className={
                  "flex items-center gap-sm px-sm py-2.5 font-medium transition-all duration-200 " +
                  (isActive
                    ? "bg-primary-container text-white shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/60")
                }
              >
                <span
                  className={
                    "material-symbols-outlined text-[20px]" + (isActive ? " fill-icon text-white" : "")
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
      <button
        type="button"
        onClick={toggle}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        className="flex items-center gap-sm px-sm py-2.5 font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/60 transition-all duration-200"
      >
        <span className="material-symbols-outlined text-[20px]">
          {isDark ? "light_mode" : "dark_mode"}
        </span>
        {isDark ? "Light mode" : "Dark mode"}
      </button>
    </nav>
  );
}
