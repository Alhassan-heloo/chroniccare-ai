import type { WeeklyPoint } from "@/lib/types/dashboard";

export type PrecisionPoint = WeeklyPoint & { timestamp: number };

/** A missing calendar day is a gap, never an interpolated medical reading.
 * Input is already aggregated by existing report/dashboard adapters. */
export function buildChartSeries(points: readonly WeeklyPoint[]): PrecisionPoint[] {
  const valid = points.filter(point => /^\d{4}-\d{2}-\d{2}$/.test(point.day) && Number.isFinite(new Date(`${point.day}T12:00:00`).getTime()));
  const byDay = new Map(valid.map(point => [point.day, point]));
  const sorted = [...byDay.keys()].sort();
  if (!sorted.length) return [];
  const first = new Date(`${sorted[0]}T12:00:00`);
  const end = new Date(`${sorted.at(-1)}T12:00:00`).getTime();
  const result: PrecisionPoint[] = [];
  for (const date = new Date(first); date.getTime() <= end; date.setDate(date.getDate() + 1)) {
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    result.push({ ...(byDay.get(day) ?? { day }), timestamp: date.getTime() });
  }
  return result;
}
