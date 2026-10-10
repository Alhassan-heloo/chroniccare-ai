import { createMeasurementPlaceholders } from "@/lib/placeholder-data/measurements.placeholder";
import { getHabitsSnapshot } from "./habits";
import { getMedicationSummary } from "./medications";
import { patientDashboardPlaceholder } from "@/lib/placeholder-data/patientDashboard.placeholder";
import type { Measurement, MeasurementInput } from "@/lib/types/measurement";
import { summarizeReport } from "@/lib/utils/reports";
// Session-only mock adapter. Replace these functions with apiClient requests when the contract is ready.
const measurements: Measurement[] = createMeasurementPlaceholders();
export async function getPatientDashboard() {
  const ordered = [...measurements].sort((a, b) =>
    b.recordedAt.localeCompare(a.recordedAt),
  );
  const pressure = ordered.find((item) => item.kind === "bloodPressure");
  const glucose = ordered.find((item) => item.kind === "glucose");
  return {
    ...structuredClone(patientDashboardPlaceholder),
    bloodPressure:
      pressure?.kind === "bloodPressure"
        ? {
            systolic: pressure.systolic,
            diastolic: pressure.diastolic,
            isExample: pressure.isExample === true,
          }
        : null,
    glucose:
      glucose?.kind === "glucose"
        ? { value: glucose.value, isExample: glucose.isExample === true }
        : null,
    weekly: summarizeReport(ordered, 7).points,
    medication: getMedicationSummary(),
    habits: getHabitsSnapshot(),
  };
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
    isExample: false,
  };
  measurements.unshift(item);
  return structuredClone(item);
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
    isExample: previous.isExample === true,
  };
  measurements[index] = updated;
  return structuredClone(updated);
}
export async function deleteMeasurement(id: string): Promise<void> {
  const index = measurements.findIndex((item) => item.id === id);
  if (index === -1) throw new Error("القراءة غير موجودة");
  measurements.splice(index, 1);
}
