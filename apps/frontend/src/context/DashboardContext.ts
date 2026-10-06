import { createContext, useContext } from "react";
export const DashboardContext = createContext<{
  openMeasurement: () => void;
} | null>(null);
export function useDashboardActions() {
  const value = useContext(DashboardContext);
  if (!value) throw new Error("Dashboard actions require DashboardLayout");
  return value;
}
