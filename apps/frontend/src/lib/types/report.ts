import type { Measurement } from "./measurement";
import type { MedicationSummary } from "./medication";
export type ReportPeriod = 7 | 30 | 90;
export interface ReportPoint {
  day: string;
  systolic?: number;
  diastolic?: number;
  glucose?: number;
}
export interface PatientReport {
  from: string;
  to: string;
  measurements: Measurement[];
  points: ReportPoint[];
  pressure: {
    count: number;
    systolic: number | null;
    diastolic: number | null;
  };
  glucose: { count: number; average: number | null };
  medicationToday: MedicationSummary;
  habitsToday: { completed: number; total: number };
}
