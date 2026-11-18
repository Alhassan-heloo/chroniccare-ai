import type { AuthorizedRequest } from "@/auth/api";
export interface DoctorIdentity { id: string; name: string; email: string }
export interface ConnectedDoctor extends DoctorIdentity { approvedAt: string | null }
export const connectionApi = {
  invite: (request: AuthorizedRequest, email: string) => request<{token: string; expiresAt: string}>("/connections/invitations", {body:{email}}),
  generate: (request: AuthorizedRequest) => request<{ code: string; expiresAt: string }>("/connections/codes", { method: "POST" }),
  preview: (request: AuthorizedRequest, code: string) => request<{ doctor: DoctorIdentity }>("/connections/preview", { body: { code } }),
  approve: (request: AuthorizedRequest, code: string) => request<void>("/connections/approve", { body: { code } }),
  list: (request: AuthorizedRequest, signal: AbortSignal) => request<{ doctors: ConnectedDoctor[] }>("/connections/doctors", { signal }),
  revoke: (request: AuthorizedRequest, doctorId: string) => request<void>(`/connections/doctors/${encodeURIComponent(doctorId)}`, { method: "DELETE" }),
};
