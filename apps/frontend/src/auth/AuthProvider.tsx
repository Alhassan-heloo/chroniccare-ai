import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AuthContext } from "./context";
import { AuthError, authRequest, apiRequest, type ApiRequestOptions, type LoginResult } from "./api";

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [session, setSession] = useState<LoginResult | null>(null);
  const [expired, setExpired] = useState(false);
  const active = useRef<LoginResult | null>(null);
  const reset = useCallback(async () => {
    active.current = null;
    setSession(null);
    await client.cancelQueries(); client.clear();
  }, [client]);
  const logout = useCallback(async () => {
    const token = active.current?.token;
    try { if (token) await authRequest("logout", { token, method: "POST" }); }
    catch (error) { if (!(error instanceof AuthError) || error.code !== "UNAUTHENTICATED") throw error; }
    finally { await reset(); setExpired(false); }
  }, [reset]);
  const login = useCallback(async (email: string, password: string) => {
    if (active.current) await logout();
    await reset();
    const result = await authRequest<LoginResult>("login", { body: { email, password } });
    try {
      const { user } = await authRequest<{ user: LoginResult["user"] }>("me", { token: result.token });
      const verified = { ...result, user };
      active.current = verified; setSession(verified); setExpired(false);
      return user;
    } catch (error) {
      await authRequest("logout", { token: result.token, method: "POST" }).catch(() => undefined);
      throw error;
    }
  }, [reset, logout]);
  const register = useCallback(async (name: string, email: string, password: string) => {
    await authRequest("register", { body: { name, email, password } });
  }, []);
  // A request belongs to the session that created this callback. Never let an
  // old query/mutation read a new account's token or commit a late response.
  const request = useCallback(async <T,>(path: string, options: Omit<ApiRequestOptions, "token"> = {}): Promise<T> => {
    if (!session || active.current !== session) throw new AuthError("SESSION_CHANGED");
    try {
      const result = await apiRequest<T>(path, { ...options, token: session.token });
      if (active.current !== session) throw new AuthError("SESSION_CHANGED");
      return result;
    } catch (error) {
      if (error instanceof AuthError && error.code === "UNAUTHENTICATED" && active.current === session) {
        await reset(); setExpired(true);
      }
      throw error;
    }
  }, [session, reset]);
  useEffect(() => {
    if (!session) return;
    let live = true;
    const invalidate = () => { if (live && active.current === session) { void reset(); setExpired(true); } };
    const timer = setTimeout(invalidate, Math.max(0, Date.parse(session.expiresAt) - Date.now()));
    const verify = () => {
      void authRequest<{ user: LoginResult["user"] }>("me", { token: session.token }).catch((error: unknown) => {
        if (error instanceof AuthError && error.code === "UNAUTHENTICATED") invalidate();
      });
    };
    window.addEventListener("focus", verify);
    const interval = setInterval(verify, 60000);
    return () => { live = false; clearTimeout(timer); clearInterval(interval); window.removeEventListener("focus", verify); };
  }, [session, reset]);
  const value = useMemo(() => ({ user: session?.user ?? null, expired, login, register, logout, request }),
    [session, expired, login, register, logout, request]);
  return <AuthContext value={value}>{children}</AuthContext>;
}
