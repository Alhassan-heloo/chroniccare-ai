import type { Measurement } from "@/lib/types/measurement";
import type { ReportPeriod, ReportPoint } from "@/lib/types/report";
import { localDateKey } from "./measurementFilters";
export const average = (values: number[]) =>
  values.length
    ? Math.round(
        (values.reduce((sum, value) => sum + value, 0) / values.length) * 10,
      ) / 10
    : null;
export function summarizeReport(
  items: Measurement[],
  period: ReportPeriod,
  now = new Date(),
) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - period + 1);
  const measurements = items
    .filter((item) => {
      const timestamp = new Date(item.recordedAt).getTime();
      return timestamp >= start.getTime() && timestamp <= now.getTime();
    })
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  const pressure = measurements.filter((item) => item.kind === "bloodPressure");
  const glucose = measurements.filter((item) => item.kind === "glucose");
  const days = new Map<string, Measurement[]>();
  for (const item of measurements) {
    const day = localDateKey(item.recordedAt);
    days.set(day, [...(days.get(day) ?? []), item]);
  }
  const points: ReportPoint[] = [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, readings]) => {
      const bp = readings.filter((item) => item.kind === "bloodPressure");
      const sugar = readings.filter((item) => item.kind === "glucose");
      return {
        day,
        ...(bp.length
          ? {
              systolic: average(bp.map((item) => item.systolic))!,
              diastolic: average(bp.map((item) => item.diastolic))!,
            }
          : {}),
        ...(sugar.length
          ? { glucose: average(sugar.map((item) => item.value))! }
          : {}),
      };
    });
  return {
    from: localDateKey(start.toISOString()),
    to: localDateKey(now.toISOString()),
    measurements,
    points,
    pressure: {
      count: pressure.length,
      systolic: average(pressure.map((item) => item.systolic)),
      diastolic: average(pressure.map((item) => item.diastolic)),
    },
    glucose: {
      count: glucose.length,
      average: average(glucose.map((item) => item.value)),
    },
  };
}
