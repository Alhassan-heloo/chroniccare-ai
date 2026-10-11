import { createContext, useContext } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type ThemeValue = { mode: ThemeMode; resolved: "light" | "dark"; setMode: (mode: ThemeMode) => void; toggle: () => void };
const fallbackTheme: ThemeValue = { mode: "system", resolved: "light", setMode: () => undefined, toggle: () => undefined };
export const ThemeContext = createContext<ThemeValue | null>(null);
export function useTheme() { return useContext(ThemeContext) ?? fallbackTheme; }
