import { demoWeeklyMeasurements } from "@/lib/placeholder-data/patientDashboard.placeholder";
import type { useLivingPresentation } from "./presentation";

export type Language = "ar" | "en";
export type Kind = "pressure" | "glucose";
export type Locale = ReturnType<typeof useLivingPresentation>["l"];
export interface Reading { id: string; date: string; systolic: number; diastolic: number; glucose: number }
/** Read-only public preview. Shares the existing seed, never the mutable patient store. */
export function previewReadings(now = new Date()): Reading[] {
  return demoWeeklyMeasurements.map((row, index) => {
    const date = new Date(now); date.setDate(date.getDate() - 6 + index); date.setHours(9, 0, 0, 0);
    return { ...row, id: `preview-${index}`, date: date.toISOString() };
  });
}
export function reportSummary(rows: Reading[], period: number) {
  const selected = rows.slice(-period), count = selected.length;
  const average = (key: "systolic" | "glucose") => count ? selected.reduce((sum, row) => sum + row[key], 0) / count : 0;
  return { selected, count, systolic: average("systolic"), glucose: average("glucose") };
}
