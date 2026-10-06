export interface MedicationInput {
  name: string;
  dosage: string;
  notes: string;
  doses: { time: string }[];
}
export interface Medication extends Omit<MedicationInput, "doses"> {
  id: string;
  doses: { time: string; takenOn: string | null }[];
}
export interface MedicationSummary {
  id: string;
  name: string;
  time: string;
  taken: number;
  total: number;
  nextDose?: { medicationId: string; time: string } | null;
}
