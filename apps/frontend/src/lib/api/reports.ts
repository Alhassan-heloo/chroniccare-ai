import { getMeasurements } from "./patient";
import { getMedicationSummary } from "./medications";
import { getHabitsSnapshot } from "./habits";
import { summarizeReport } from "@/lib/utils/reports";
import type { PatientReport, ReportPeriod } from "@/lib/types/report";
export async function getPatientReport(
  period: ReportPeriod,
): Promise<PatientReport> {
  const habits = getHabitsSnapshot();
  return {
    ...summarizeReport(await getMeasurements(), period),
    medicationToday: getMedicationSummary(),
    habitsToday: {
      total: habits.length,
      completed: habits.filter((item) => item.progress >= item.target).length,
    },
  };
}
