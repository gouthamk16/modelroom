import { useEffect, useState } from "react";

const KEY = "modelroom.theme";

export function getStoredTheme(): "dark" | "light" {
  return localStorage.getItem(KEY) === "dark" ? "dark" : "light";
}

/** Apply the persisted theme to <html>. Call once at startup to avoid a flash. */
export function applyStoredTheme() {
  document.documentElement.classList.toggle("dark", getStoredTheme() === "dark");
}

export function useTheme() {
  const [isDark, setIsDark] = useState(() => getStoredTheme() === "dark");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem(KEY, isDark ? "dark" : "light");
  }, [isDark]);

  return { isDark, toggle: () => setIsDark((v) => !v) };
}
