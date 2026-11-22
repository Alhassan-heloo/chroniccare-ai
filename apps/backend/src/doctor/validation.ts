import { habitDate } from "../habits/validation.js";
import { HttpError } from "../middleware/errors.js";

export function doctorPatientId(value: string): string {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)) {
    throw new HttpError(400, "INVALID_PATIENT_ID", "Patient ID is invalid.");
  }
  return value;
}

export function doctorRecordDate(value: unknown): string {
  if (Array.isArray(value)) throw new HttpError(400, "INVALID_HABIT_DATE", "Date is invalid.");
  return habitDate(value);
}
