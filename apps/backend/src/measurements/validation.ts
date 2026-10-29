import { HttpError } from "../middleware/errors.js";

export type MeasurementInput =
  | { kind: "bloodPressure"; systolic: number; diastolic: number }
  | { kind: "glucose"; value: number };
export type Measurement = MeasurementInput & { id: string; recordedAt: string; isExample: false };
export interface ValidatedMeasurement { input: MeasurementInput; recordedAt?: string }

function invalid(): never { throw new HttpError(400, "INVALID_MEASUREMENT", "Check the measurement fields."); }
function positive(value: unknown, maximum: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= maximum;
}

// Explicit offset, calendar validity and millisecond precision prevent silently
// normalizing impossible dates or losing precision on a JavaScript round trip.
function recordedDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) invalid();
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const calendar = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || calendar.getUTCFullYear() !== year || calendar.getUTCMonth() + 1 !== month || calendar.getUTCDate() !== day || Number(value.slice(11, 13)) > 23) invalid();
  const date = new Date(timestamp);
  if (date.getUTCFullYear() < 1 || date.getUTCFullYear() > 9999) invalid();
  return date.toISOString();
}

export function validateMeasurement(body: unknown, allowRecordedAt = false): ValidatedMeasurement {
  if (!body || typeof body !== "object" || Array.isArray(body)) invalid();
  const fields = body as Record<string, unknown>;
  const allowed = fields.kind === "bloodPressure" ? ["kind", "systolic", "diastolic"] : ["kind", "value"];
  if (allowRecordedAt) allowed.push("recordedAt");
  if (Object.keys(fields).some(key => !allowed.includes(key))) invalid();
  let input: MeasurementInput;
  if (fields.kind === "bloodPressure" && positive(fields.systolic, 400) && positive(fields.diastolic, 300) && Number.isInteger(fields.systolic) && Number.isInteger(fields.diastolic) && fields.systolic > fields.diastolic) {
    input = { kind: "bloodPressure", systolic: fields.systolic, diastolic: fields.diastolic };
  } else if (fields.kind === "glucose" && positive(fields.value, 1500)) {
    input = { kind: "glucose", value: fields.value };
  } else invalid();
  return { input, ...(Object.hasOwn(fields, "recordedAt") ? { recordedAt: recordedDate(fields.recordedAt) } : {}) };
}

export function measurementId(value: string): string {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)) {
    throw new HttpError(400, "INVALID_MEASUREMENT_ID", "Measurement ID is invalid.");
  }
  return value;
}
