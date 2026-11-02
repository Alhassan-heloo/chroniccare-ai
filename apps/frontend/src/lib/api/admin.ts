import { AuthError, type AuthorizedRequest } from "@/auth/api";
import type { AdminDoctor, CreateDoctorInput } from "@/lib/types/admin";

function doctor(value: unknown): AdminDoctor {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AuthError("INVALID_RESPONSE");
  const fields = value as Record<string, unknown>;
  if (Object.keys(fields).some(key => !["id", "name", "email", "role"].includes(key))
    || typeof fields.id !== "string" || typeof fields.name !== "string" || !fields.name.trim()
    || typeof fields.email !== "string" || fields.role !== "doctor") throw new AuthError("INVALID_RESPONSE");
  return { id: fields.id, name: fields.name, email: fields.email, role: "doctor" };
}

export async function getAdminDoctors(request: AuthorizedRequest, signal?: AbortSignal): Promise<AdminDoctor[]> {
  const response = await request<unknown>("/admin/doctors", { signal });
  if (!response || typeof response !== "object" || !("doctors" in response) || !Array.isArray(response.doctors)) {
    throw new AuthError("INVALID_RESPONSE");
  }
  return response.doctors.map(doctor);
}

export async function createAdminDoctor(request: AuthorizedRequest, input: CreateDoctorInput): Promise<AdminDoctor> {
  const response = await request<unknown>("/admin/doctors", { method: "POST", body: input });
  if (!response || typeof response !== "object" || !("doctor" in response)) throw new AuthError("INVALID_RESPONSE");
  return doctor(response.doctor);
}
