import type { User } from "@/lib/types/user";

export class AuthError extends Error {
  constructor(public readonly code: string) { super(code); }
}
const base = (import.meta.env?.VITE_API_URL || "http://localhost:3001/api").replace(/\/$/, "");
export interface ApiRequestOptions { body?: unknown; token?: string; method?: string; signal?: AbortSignal }
export type AuthorizedRequest = <T>(path: string, options?: Omit<ApiRequestOptions, "token">) => Promise<T>;
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      method: options.method ?? (options.body ? "POST" : "GET"),
      headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}) },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      credentials: "omit", signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000), cache: "no-store",
    });
  } catch { throw new AuthError("NETWORK"); }
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { error?: { code?: string } } | null;
    throw new AuthError(error?.error?.code ?? "UNKNOWN");
  }
  if (response.status === 204) return undefined as T;
  try { return await response.json() as T; } catch { throw new AuthError("UNKNOWN"); }
}
export function authRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> { return apiRequest<T>(`/auth/${path}`, options); }
export interface LoginResult { user: User; token: string; expiresAt: string }
export const roleHome = (role: User["role"]) => `/${role}/dashboard`;
export function safeReturnTo(value: string | null, role: User["role"]) {
  return value?.startsWith(`/${role}/`) && !value.includes("\\") ? value : roleHome(role);
}
