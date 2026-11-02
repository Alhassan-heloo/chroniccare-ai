import type { User } from "./user";
import type { Habit } from "./habit";
import type { Measurement } from "./measurement";
import type { Medication } from "./medication";
export interface Doctor extends User {
  role: "doctor";
}
export interface DoctorPatient { id: string; name: string }
export interface DoctorPatientRecord {
  patient: DoctorPatient;
  date: string;
  measurements: Measurement[];
  medications: Medication[];
  habits: Habit[];
}
