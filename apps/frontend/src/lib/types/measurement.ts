export type MeasurementKind = "bloodPressure" | "glucose";
export type MeasurementInput =
  | { kind: "bloodPressure"; systolic: number; diastolic: number }
  | { kind: "glucose"; value: number };
export type Measurement = MeasurementInput & { id: string; recordedAt: string };
