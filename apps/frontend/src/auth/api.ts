import type { User } from "@/lib/types/user";

export class AuthError extends Error {
  constructor(public readonly code: string) { super(code); }
}
const base = (import.meta.env?.VITE_API_URL || "http://localhost:3001/api").replace(/\/$/, "");
let csrfToken: string | undefined;
async function csrf() {
  if (!csrfToken) {
    const response = await fetch(`${base}/auth/csrf`, { credentials: "include", cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new AuthError("NETWORK");
    const body = await response.json() as { csrfToken?: string };
    if (!body.csrfToken || !/^[a-f0-9]{64}$/.test(body.csrfToken)) throw new AuthError("UNKNOWN");
    csrfToken = body.csrfToken;
  }
  return csrfToken;
}
export interface ApiRequestOptions { body?: unknown; token?: string; method?: string; signal?: AbortSignal; accountId?: string }
export type AuthorizedRequest = <T>(path: string, options?: Omit<ApiRequestOptions, "token">) => Promise<T>;
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}, csrfRetried = false): Promise<T> {
  let response: Response;
  const method = options.method ?? (options.body ? "POST" : "GET");
  try {
    const csrfHeader = !["GET", "HEAD"].includes(method) ? await csrf() : undefined;
    response = await fetch(`${base}${path}`, {
      method,
      headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}), ...(csrfHeader ? { "X-CSRF-Token": csrfHeader } : {}) },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      credentials: "include", signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000), cache: "no-store",
    });
  } catch { throw new AuthError("NETWORK"); }
  const responseAccount = response.headers.get("X-Account-ID");
  if (options.accountId && responseAccount && responseAccount !== options.accountId) throw new AuthError("SESSION_CHANGED");
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { error?: { code?: string } } | null;
    if (error?.error?.code === "CSRF_INVALID" && !csrfRetried) { csrfToken = undefined; return apiRequest<T>(path, options, true); }
    throw new AuthError(error?.error?.code ?? "UNKNOWN");
  }
  if (options.accountId && response.headers.get("X-Account-ID") !== options.accountId) throw new AuthError("SESSION_CHANGED");
  if (response.status === 204) return undefined as T;
  try { return await response.json() as T; } catch { throw new AuthError("UNKNOWN"); }
}
export function authRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> { return apiRequest<T>(`/auth/${path}`, options); }
export interface LoginResult { user: User; expiresAt?: string }
export const roleHome = (role: User["role"]) => `/${role}/dashboard`;
export function safeReturnTo(value: string | null, role: User["role"]) {
  // This public review route handles wrong-account recovery itself, without exposing a record.
  if (value && /^\/patient\/invitation(?:#token=[A-Za-z0-9_-]{32})?$/.test(value)) return value;
  return value?.startsWith(`/${role}/`) && !value.includes("\\") ? value : roleHome(role);
}
