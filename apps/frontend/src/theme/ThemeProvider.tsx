import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ThemeContext, type ThemeMode } from "./context";
const systemDark = () => typeof window !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches;
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => { const saved = typeof window === "undefined" ? null : localStorage.getItem("cc-theme"); return saved === "light" || saved === "dark" || saved === "system" ? saved : "system"; });
  const [resolved, setResolved] = useState<"light" | "dark">(() => mode === "system" ? (systemDark() ? "dark" : "light") : mode);
  const setMode = useCallback((next: ThemeMode) => { localStorage.setItem("cc-theme", next); setModeState(next); }, []);
  useEffect(() => { const media = matchMedia("(prefers-color-scheme: dark)"); const apply = () => { const next = mode === "system" ? (media.matches ? "dark" : "light") : mode; setResolved(next); document.documentElement.dataset.theme = next; document.documentElement.style.colorScheme = next; const canvas = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim(); if (canvas) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", canvas); }; apply(); media.addEventListener("change", apply); return () => media.removeEventListener("change", apply); }, [mode]);
  const toggle = useCallback(() => setMode(mode === "light" ? "dark" : mode === "dark" ? "system" : "light"), [mode, setMode]);
  const value = useMemo(() => ({ mode, resolved, setMode, toggle }), [mode, resolved, setMode, toggle]);
  return <ThemeContext value={value}>{children}</ThemeContext>;
}
