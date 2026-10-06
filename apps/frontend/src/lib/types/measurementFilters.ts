import type { MeasurementKind } from "./measurement";
export interface MeasurementFilters {
  kind: MeasurementKind | "all";
  from: string;
  to: string;
}
