import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AuthContext } from "./context";
import { AuthError, authRequest, apiRequest, type ApiRequestOptions, type LoginResult } from "./api";

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [session, setSession] = useState<LoginResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const active = useRef<LoginResult | null>(null);
  const epoch = useRef(0);
  const channel = useRef<BroadcastChannel | null>(null);
  const reset = useCallback(() => {
    epoch.current++; active.current = null; setSession(null); client.clear();
  }, [client]);
  useEffect(() => {
    if (!("BroadcastChannel" in window)) return;
    const updates = new BroadcastChannel("chroniccare-account"); channel.current = updates;
    updates.onmessage = () => {
      reset();
      const version = epoch.current;
      void authRequest<LoginResult>("me").then(result => {
        if (epoch.current === version) { active.current = result; setSession(result); }
      }).catch(() => undefined);
    };
    return () => { updates.close(); channel.current = null; };
  }, [reset]);
  useLayoutEffect(() => { if (!session) client.clear(); }, [client, session]);
  useEffect(() => {
    let live = true;
    const version = epoch.current;
    void authRequest<LoginResult>("me").then(result => {
      if (live && epoch.current === version) { active.current = result; setSession(result); }
    }).catch(() => { /* Missing session or unavailable backend: shared Login remains available. */ })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);
  const logout = useCallback(async () => {
    try { await authRequest("logout", { method: "POST" }); }
    catch (error) { if (!(error instanceof AuthError) || error.code !== "UNAUTHENTICATED") throw error; }
    finally { reset(); setExpired(false); channel.current?.postMessage("changed"); }
  }, [reset]);
  const login = useCallback(async (email: string, password: string) => {
    reset();
    const version = epoch.current;
    await authRequest<LoginResult>("login", { body: { email, password } });
    if (version !== epoch.current) throw new AuthError("SESSION_CHANGED");
    const verified = await authRequest<LoginResult>("me");
    if (version !== epoch.current) throw new AuthError("SESSION_CHANGED");
    active.current = verified; setSession(verified); setExpired(false);
    channel.current?.postMessage("changed");
    return verified.user;
  }, [reset]);
  const register = useCallback(async (name: string, email: string, password: string) => {
    await authRequest("register", { body: { name, email, password } });
  }, []);
  const request = useCallback(async <T,>(path: string, options: Omit<ApiRequestOptions, "token"> = {}): Promise<T> => {
    if (!session || active.current !== session) throw new AuthError("SESSION_CHANGED");
    try {
      const result = await apiRequest<T>(path, { ...options, accountId: session.user.id });
      if (active.current !== session) throw new AuthError("SESSION_CHANGED");
      return result;
    } catch (error) {
      if (error instanceof AuthError && ["UNAUTHENTICATED", "SESSION_CHANGED"].includes(error.code) && active.current === session) { reset(); setExpired(true); }
      throw error;
    }
  }, [session, reset]);
  useEffect(() => {
    if (!session) return;
    let live = true;
    const verify = () => {
      void authRequest<LoginResult>("me").then(result => {
        if (live && active.current === session && (result.user.id !== session.user.id || result.user.role !== session.user.role)) {
          reset(); active.current = result; setSession(result);
        }
      }).catch((error: unknown) => {
        if (live && active.current === session && error instanceof AuthError && error.code === "UNAUTHENTICATED") { reset(); setExpired(true); }
      });
    };
    window.addEventListener("focus", verify);
    // No background keepalive: idle sessions must be able to expire.
    return () => { live = false; window.removeEventListener("focus", verify); };
  }, [session, reset]);
  const value = useMemo(() => ({ user: session?.user ?? null, loading, expired, login, register, logout, request }),
    [session, loading, expired, login, register, logout, request]);
  return <AuthContext value={value}>{children}</AuthContext>;
}
