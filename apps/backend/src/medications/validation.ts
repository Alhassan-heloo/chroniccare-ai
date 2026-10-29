import { HttpError } from "../middleware/errors.js";

export interface MedicationInput {
  name: string;
  dosage: string;
  notes: string;
  doses: { time: string }[];
}
export interface Medication extends Omit<MedicationInput, "doses"> {
  id: string;
  doses: { time: string; takenOn: string | null }[];
}
export interface DoseAction { date: string; taken: boolean }

function invalid(code = "INVALID_MEDICATION"): never {
  throw new HttpError(400, code, "Check the medication fields.");
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function exact(fields: Record<string, unknown>, allowed: readonly string[]) {
  if (Object.keys(fields).some(key => !allowed.includes(key))) invalid();
}
function text(value: unknown, minimum: number, maximum: number): string {
  if (typeof value !== "string") invalid();
  const result = value.trim();
  if (result.length < minimum || result.length > maximum) invalid();
  return result;
}

export function medicationTime(value: unknown): string {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) invalid("INVALID_MEDICATION_TIME");
  return value;
}

export function medicationDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid("INVALID_MEDICATION_DATE");
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (year === undefined || month === undefined || day === undefined || year < 1
    || parsed.getUTCFullYear() !== year || parsed.getUTCMonth() + 1 !== month || parsed.getUTCDate() !== day) {
    invalid("INVALID_MEDICATION_DATE");
  }
  return value;
}

export function validateMedication(body: unknown): MedicationInput {
  if (!object(body)) invalid();
  exact(body, ["name", "dosage", "notes", "doses"]);
  if (!Array.isArray(body.doses) || body.doses.length < 1 || body.doses.length > 6) invalid();
  const doses = body.doses.map(dose => {
    if (!object(dose)) invalid();
    exact(dose, ["time"]);
    return { time: medicationTime(dose.time) };
  });
  if (new Set(doses.map(dose => dose.time)).size !== doses.length) invalid();
  return {
    name: text(body.name, 2, 100),
    dosage: text(body.dosage, 1, 100),
    notes: text(body.notes, 0, 400),
    doses: doses.sort((a, b) => a.time.localeCompare(b.time)),
  };
}

export function validateDoseAction(body: unknown): DoseAction {
  if (!object(body)) invalid("INVALID_DOSE_ACTION");
  exact(body, ["date", "taken"]);
  if (typeof body.taken !== "boolean") invalid("INVALID_DOSE_ACTION");
  return { date: medicationDate(body.date), taken: body.taken };
}

export function medicationId(value: string): string {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)) {
    throw new HttpError(400, "INVALID_MEDICATION_ID", "Medication ID is invalid.");
  }
  return value;
}
