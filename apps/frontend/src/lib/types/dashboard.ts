import type { Patient } from "./patient";
import type { MedicationSummary } from "./medication";
import type { Habit } from "./habit";
import type { Notification } from "./notification";
export interface WeeklyPoint {
  day: string;
  systolic: number;
  diastolic: number;
  glucose: number;
}
export interface PatientDashboard {
  patient: Patient;
  bloodPressure: { systolic: number; diastolic: number; isExample: boolean };
  glucose: { value: number; isExample: boolean };
  medication: MedicationSummary;
  habits: Habit[];
  reminder: Notification;
  weekly: WeeklyPoint[];
}
