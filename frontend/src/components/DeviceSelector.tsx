import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

const KEY = "modelroom.devices";

function loadSelection(): string[] | null {
  try {
    const v = localStorage.getItem(KEY);
    return v ? (JSON.parse(v) as string[]) : null;
  } catch {
    return null;
  }
}

export function DeviceSelector() {
  const { data: devices = [] } = useQuery({ queryKey: ["devices"], queryFn: api.listDevices });
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!devices.length) return;
    const saved = loadSelection()?.filter((id) => devices.some((d) => d.id === id));
    if (saved && saved.length) {
      setSelected(saved);
    } else {
      const gpu = devices.find((d) => d.kind === "cuda");
      setSelected([gpu ? gpu.id : "cpu"]);
    }
  }, [devices]);

  useEffect(() => {
    if (selected.length) localStorage.setItem(KEY, JSON.stringify(selected));
  }, [selected]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  const summary =
    selected.length === 0
      ? "no device"
      : selected.length === 1
        ? (devices.find((d) => d.id === selected[0])?.name ?? selected[0])
        : `${selected.length} devices`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-[11px] font-medium text-on-surface-variant hover:text-primary transition-colors"
      >
        <span className="material-symbols-outlined text-[14px] text-primary">memory</span>
        <span className="truncate max-w-[220px]">{summary}</span>
        <span className="material-symbols-outlined text-[14px]">
          {open ? "expand_more" : "expand_less"}
        </span>
      </button>
      {open && (
        <div className="absolute bottom-7 left-0 w-72 bg-surface-container-lowest border border-outline-variant rounded-lg shadow-lg p-sm z-50">
          <div className="text-label-md uppercase text-on-surface-variant px-1 pb-xs">
            Compute devices
          </div>
          {devices.map((d) => (
            <label
              key={d.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-surface-variant/50 cursor-pointer"
            >
              <input
                type="checkbox"
                className="accent-[#a63b21]"
                checked={selected.includes(d.id)}
                onChange={() => toggle(d.id)}
              />
              <span
                className={
                  "material-symbols-outlined text-[16px] " +
                  (d.kind === "cuda" ? "text-primary" : "text-on-surface-variant")
                }
              >
                {d.kind === "cuda" ? "developer_board" : "memory"}
              </span>
              <span className="flex-1 text-body-sm text-on-surface truncate">{d.name}</span>
              {d.memory_mb != null && (
                <span className="text-label-sm text-on-surface-variant">
                  {Math.round(d.memory_mb / 1024)}GB
                </span>
              )}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
