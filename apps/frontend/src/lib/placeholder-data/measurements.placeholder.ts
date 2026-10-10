import type { Measurement } from "@/lib/types/measurement";
import { patientDashboardPlaceholder } from "./patientDashboard.placeholder";

// Temporary examples for previewing reports. Set false to start with an empty log.
export const DEMO_WEEK_ENABLED = true;
export function createMeasurementPlaceholders(now = new Date()): Measurement[] {
  if (!DEMO_WEEK_ENABLED) return [];
  return patientDashboardPlaceholder.weekly
    .flatMap((point, index): Measurement[] => {
      const date = new Date(now);
      date.setDate(date.getDate() - (6 - index));
      const recordedAt = date.toISOString();
      return [
        {
          id: `demo-pressure-${index}`,
          kind: "bloodPressure",
          systolic: point.systolic,
          diastolic: point.diastolic,
          recordedAt,
        },
        {
          id: `demo-glucose-${index}`,
          kind: "glucose",
          value: point.glucose,
          recordedAt,
        },
      ];
    })
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
}
