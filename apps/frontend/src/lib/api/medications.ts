import type { Medication, MedicationInput } from "@/lib/types/medication";
import { createMedicationPlaceholders } from "@/lib/placeholder-data/medications.placeholder";
import { medicationSchema } from "@/lib/utils/medicationSchema";
import { summarizeMedications, todayKey } from "@/lib/utils/medications";
// Guest-only session adapter. Authenticated medications use the PostgreSQL API.
const medications = createMedicationPlaceholders();
export async function getMedications() {
  return structuredClone(medications);
}
export function getMedicationSummary(items = medications) {
  return summarizeMedications(items);
}
export async function addMedication(input: MedicationInput) {
  const valid = medicationSchema.parse(input);
  const item: Medication = {
    ...valid,
    id: crypto.randomUUID(),
    doses: valid.doses
      .map((dose) => ({ ...dose, takenOn: null }))
      .sort((a, b) => a.time.localeCompare(b.time)),
  };
  medications.push(item);
  return structuredClone(item);
}
export async function updateMedication({
  id,
  input,
}: {
  id: string;
  input: MedicationInput;
}) {
  const valid = medicationSchema.parse(input);
  const index = medications.findIndex((item) => item.id === id);
  const previous = medications[index];
  if (!previous) throw new Error("الدواء غير موجود");
  // Unchanged schedule times retain today's record; new times start unrecorded.
  const updated: Medication = {
    ...valid,
    id,
    doses: valid.doses
      .map((dose) => ({
        ...dose,
        takenOn:
          previous.doses.find((old) => old.time === dose.time)?.takenOn ?? null,
      }))
      .sort((a, b) => a.time.localeCompare(b.time)),
  };
  medications[index] = updated;
  return structuredClone(updated);
}
export async function deleteMedication(id: string) {
  const index = medications.findIndex((item) => item.id === id);
  if (index < 0) throw new Error("الدواء غير موجود");
  medications.splice(index, 1);
}
export async function setDoseTaken({
  id,
  time,
  taken,
}: {
  id: string;
  time: string;
  taken: boolean;
}) {
  const dose = medications
    .find((item) => item.id === id)
    ?.doses.find((item) => item.time === time);
  if (!dose) throw new Error("الموعد غير موجود");
  dose.takenOn = taken ? todayKey() : null;
}
