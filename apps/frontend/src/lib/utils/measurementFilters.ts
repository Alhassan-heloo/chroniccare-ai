import type { Measurement } from "@/lib/types/measurement";
import type { MeasurementFilters } from "@/lib/types/measurementFilters";
export function localDateKey(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function filterMeasurements(
  items: Measurement[],
  filters: MeasurementFilters,
) {
  return items
    .filter((item) => {
      const day = localDateKey(item.recordedAt);
      return (
        (filters.kind === "all" || item.kind === filters.kind) &&
        (!filters.from || day >= filters.from) &&
        (!filters.to || day <= filters.to)
      );
    })
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
}
export function measurementValue(item: Measurement) {
  return item.kind === "bloodPressure"
    ? `${item.systolic}/${item.diastolic}`
    : String(item.value);
}
export function measurementLabel(item: Measurement) {
  return item.kind === "bloodPressure" ? "ضغط الدم" : "سكر الدم";
}
