import { getMedicationSummary } from "./medications";
import { patientDashboardPlaceholder } from "@/lib/placeholder-data/patientDashboard.placeholder";
import type { Measurement, MeasurementInput } from "@/lib/types/measurement";
// Session-only mock adapter. Replace these functions with apiClient requests when the contract is ready.
const dashboard = structuredClone(patientDashboardPlaceholder);
const measurements: Measurement[] = [];
export async function getPatientDashboard() {
  return { ...structuredClone(dashboard), medication: getMedicationSummary() };
}
export async function getMeasurements() {
  return structuredClone(measurements);
}
export async function addMeasurement(
  input: MeasurementInput,
): Promise<Measurement> {
  const item: Measurement = {
    ...input,
    id: crypto.randomUUID(),
    recordedAt: new Date().toISOString(),
  };
  measurements.unshift(item);
  syncLatestMeasurements();
  return structuredClone(item);
}
// Derive both cards after every change, including a type change or deleting the latest reading.
function syncLatestMeasurements() {
  const pressure = measurements.find((item) => item.kind === "bloodPressure");
  const glucose = measurements.find((item) => item.kind === "glucose");
  dashboard.bloodPressure =
    pressure?.kind === "bloodPressure"
      ? {
          systolic: pressure.systolic,
          diastolic: pressure.diastolic,
          isExample: false,
        }
      : structuredClone(patientDashboardPlaceholder.bloodPressure);
  dashboard.glucose =
    glucose?.kind === "glucose"
      ? { value: glucose.value, isExample: false }
      : structuredClone(patientDashboardPlaceholder.glucose);
}
export async function updateMeasurement({
  id,
  input,
}: {
  id: string;
  input: MeasurementInput;
}): Promise<Measurement> {
  const index = measurements.findIndex((item) => item.id === id);
  const previous = measurements[index];
  if (!previous) throw new Error("القراءة غير موجودة");
  const updated: Measurement = {
    ...input,
    id,
    recordedAt: previous.recordedAt,
  };
  measurements[index] = updated;
  syncLatestMeasurements();
  return structuredClone(updated);
}
export async function deleteMeasurement(id: string): Promise<void> {
  const index = measurements.findIndex((item) => item.id === id);
  if (index === -1) throw new Error("القراءة غير موجودة");
  measurements.splice(index, 1);
  syncLatestMeasurements();
}
export async function toggleHabit(id: string) {
  const habit = dashboard.habits.find((item) => item.id === id);
  if (!habit) throw new Error("العادات غير متاحة");
  habit.completed = !habit.completed;
}
