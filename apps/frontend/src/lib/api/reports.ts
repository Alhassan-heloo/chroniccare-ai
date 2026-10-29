import { getMeasurements } from "./patient";
import { getMedicationSummary } from "./medications";
import { getHabitsSnapshot } from "./habits";
import { summarizeReport } from "@/lib/utils/reports";
import type { PatientReport, ReportPeriod } from "@/lib/types/report";
import type { Measurement } from "@/lib/types/measurement";
import type { Medication } from "@/lib/types/medication";
export async function getPatientReport(
  period: ReportPeriod,
  readings?: Measurement[],
  medications?: Medication[],
): Promise<PatientReport> {
  const habits = getHabitsSnapshot();
  return {
    ...summarizeReport(readings ?? await getMeasurements(), period),
    medicationToday: getMedicationSummary(medications),
    habitsToday: {
      total: habits.length,
      completed: habits.filter((item) => item.progress >= item.target).length,
    },
  };
}
