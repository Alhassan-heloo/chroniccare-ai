import { AuthError, type AuthorizedRequest } from "@/auth/api";
import type { Medication, MedicationInput } from "@/lib/types/medication";
import { medicationSchema } from "@/lib/utils/medicationSchema";
import { todayKey } from "@/lib/utils/medications";

export interface MedicationSource {
  list(signal?: AbortSignal): Promise<Medication[]>;
  create(input: MedicationInput): Promise<Medication>;
  update(update: { id: string; input: MedicationInput }): Promise<Medication>;
  delete(id: string): Promise<void>;
  setDoseTaken(action: { id: string; time: string; taken: boolean }): Promise<void>;
}
function date(value: unknown): value is string { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value); }
function record(value: unknown): Medication {
  if (!value || typeof value !== "object") throw new AuthError("INVALID_RESPONSE");
  const fields = value as Record<string, unknown>, rawDoses = fields.doses;
  if (typeof fields.id !== "string" || !Array.isArray(rawDoses)) throw new AuthError("INVALID_RESPONSE");
  const doses = rawDoses.map(dose => {
    if (!dose || typeof dose !== "object") throw new AuthError("INVALID_RESPONSE");
    const item = dose as Record<string, unknown>;
    if (typeof item.time !== "string" || (item.takenOn !== null && !date(item.takenOn))) throw new AuthError("INVALID_RESPONSE");
    return { time: item.time, takenOn: item.takenOn as string | null };
  });
  const input = medicationSchema.safeParse({ name: fields.name, dosage: fields.dosage, notes: fields.notes, doses: doses.map(({ time }) => ({ time })) });
  if (!input.success) throw new AuthError("INVALID_RESPONSE");
  return { ...input.data, id: fields.id, doses };
}
function single(response: unknown): Medication {
  if (!response || typeof response !== "object" || !("medication" in response)) throw new AuthError("INVALID_RESPONSE");
  return record(response.medication);
}
function dayPath(path: string) { return `${path}${path.includes("?") ? "&" : "?"}date=${todayKey()}`; }

export function authenticatedMedications(request: AuthorizedRequest): MedicationSource {
  return {
    async list(signal) {
      const response = await request<unknown>(dayPath("/medications"), { signal });
      if (!response || typeof response !== "object" || !("medications" in response) || !Array.isArray(response.medications)) throw new AuthError("INVALID_RESPONSE");
      return response.medications.map(record);
    },
    async create(input) { return single(await request<unknown>(dayPath("/medications"), { method: "POST", body: input })); },
    async update({ id, input }) { return single(await request<unknown>(dayPath(`/medications/${encodeURIComponent(id)}`), { method: "PUT", body: input })); },
    delete(id) { return request<void>(`/medications/${encodeURIComponent(id)}`, { method: "DELETE" }); },
    setDoseTaken({ id, time, taken }) {
      return request<void>(`/medications/${encodeURIComponent(id)}/doses/${encodeURIComponent(time)}`, { method: "PUT", body: { date: todayKey(), taken } });
    },
  };
}
