import type { Patient } from "./patient";
import type { MedicationSummary } from "./medication";
import type { Habit } from "./habit";
import type { Notification } from "./notification";
export interface WeeklyPoint {
  day: string;
  systolic?: number;
  diastolic?: number;
  glucose?: number;
  isExample?: boolean;
}
export interface PatientDashboard {
  patient: Patient;
  bloodPressure: {
    systolic: number;
    diastolic: number;
    recordedAt: string;
    isExample: boolean;
  } | null;
  glucose: { value: number; recordedAt: string; isExample: boolean } | null;
  medication: MedicationSummary;
  habits: Habit[];
  reminder: Notification | null;
  weekly: WeeklyPoint[];
}
