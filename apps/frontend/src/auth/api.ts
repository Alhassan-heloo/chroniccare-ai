import type { User } from "@/lib/types/user";

export class AuthError extends Error {
  constructor(public readonly code: string) { super(code); }
}
const base = (import.meta.env?.VITE_API_URL || "http://localhost:3001/api").replace(/\/$/, "");
export async function authRequest<T>(path: string, options: { body?: unknown; token?: string; method?: string } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${base}/auth/${path}`, {
      method: options.method ?? (options.body ? "POST" : "GET"),
      headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}) },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      credentials: "omit", signal: AbortSignal.timeout(15000), cache: "no-store",
    });
  } catch { throw new AuthError("NETWORK"); }
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { error?: { code?: string } } | null;
    throw new AuthError(error?.error?.code ?? "UNKNOWN");
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
export interface LoginResult { user: User; token: string; expiresAt: string }
export const roleHome = (role: User["role"]) => `/${role}/dashboard`;
export function safeReturnTo(value: string | null, role: User["role"]) {
  return value?.startsWith(`/${role}/`) && !value.includes("\\") ? value : roleHome(role);
}
