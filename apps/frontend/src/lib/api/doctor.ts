import { AuthError, type AuthorizedRequest } from "@/auth/api";
import { parseHabit } from "@/lib/api/persistentHabits";
import { parseMeasurement } from "@/lib/api/measurements";
import { parseMedication } from "@/lib/api/persistentMedications";
import type { DoctorPatient, DoctorPatientRecord } from "@/lib/types/doctor";
import { todayKey } from "@/lib/utils/medications";

export interface CareActivity {id:string;kind:"dose"|"habit";title:string;day:string;recordedAt:string;scheduledTime:string|null;value:number|null;unit:"steps"|"minutes"|"cups"|"times"|null}
export async function getDoctorActivity(request:AuthorizedRequest,patientId:string,date:string,signal?:AbortSignal):Promise<CareActivity[]> {
 const response=await request<{patientId:string;events:unknown[]}>(`/doctor/patients/${encodeURIComponent(patientId)}/activity?date=${date}`,{signal});
 if(!response || response.patientId!==patientId || !Array.isArray(response.events))throw new AuthError("INVALID_RESPONSE");
 return response.events.map(value=>{if(!value || typeof value!=="object")throw new AuthError("INVALID_RESPONSE");const item=value as CareActivity;
 if(typeof item.id!=="string" || !["dose","habit"].includes(item.kind) || typeof item.title!=="string" || typeof item.day!=="string" || !/^\d{4}-\d{2}-\d{2}$/.test(item.day) || typeof item.recordedAt!=="string" || !Number.isFinite(Date.parse(item.recordedAt)) || !(item.scheduledTime===null || typeof item.scheduledTime==="string") || !(item.value===null || Number.isFinite(item.value)) || !(item.unit===null || ["steps","minutes","cups","times"].includes(item.unit)) || (item.kind==="habit" && (item.value===null || item.unit===null)) || (item.kind==="dose" && item.scheduledTime===null))throw new AuthError("INVALID_RESPONSE");
 return item;});
}

function patient(value: unknown): DoctorPatient {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AuthError("INVALID_RESPONSE");
  const fields = value as Record<string, unknown>;
  if (Object.keys(fields).some(key => !["id", "name"].includes(key))
    || typeof fields.id !== "string" || typeof fields.name !== "string" || !fields.name.trim()) {
    throw new AuthError("INVALID_RESPONSE");
  }
  return { id: fields.id, name: fields.name };
}

export async function getDoctorPatients(request: AuthorizedRequest, signal?: AbortSignal): Promise<DoctorPatient[]> {
  const response = await request<unknown>("/doctor/patients", { signal });
  if (!response || typeof response !== "object" || !("patients" in response) || !Array.isArray(response.patients)) {
    throw new AuthError("INVALID_RESPONSE");
  }
  return response.patients.map(patient);
}

export async function getDoctorPatient(
  request: AuthorizedRequest,
  patientId: string,
  signal?: AbortSignal,
): Promise<DoctorPatientRecord> {
  const response = await request<unknown>(`/doctor/patients/${encodeURIComponent(patientId)}?date=${todayKey()}`, { signal });
  if (!response || typeof response !== "object" || Array.isArray(response)) throw new AuthError("INVALID_RESPONSE");
  const fields = response as Record<string, unknown>;
  if (patient(fields.patient).id !== patientId) throw new AuthError("INVALID_RESPONSE");
  if (Object.keys(fields).some(key => !["patient", "date", "measurements", "medications", "habits"].includes(key))
    || typeof fields.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fields.date)
    || !Array.isArray(fields.measurements) || !Array.isArray(fields.medications) || !Array.isArray(fields.habits)) {
    throw new AuthError("INVALID_RESPONSE");
  }
  return {
    patient: patient(fields.patient),
    date: fields.date,
    measurements: fields.measurements.map(parseMeasurement),
    medications: fields.medications.map(parseMedication),
    habits: fields.habits.map(parseHabit),
  };
}
