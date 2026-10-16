import { useState } from "react";
import { Link, Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "./context";
import { roleHome } from "./api";
import type { User } from "@/lib/types/user";
import { useI18n } from "@/i18n/context";
import { Button } from "@/components/ui/Button";
import { Preferences } from "@/components/layout/Preferences";

export function ProtectedRoute({ role }: { role: User["role"] }) {
  const { user, demo } = useAuth();
  const location = useLocation();
  if (demo && role === "patient") return <Outlet />;
  if (!user) return <Navigate replace to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search + location.hash)}`} />;
  if (user.role !== role) return <Navigate replace to={roleHome(user.role)} />;
  return <Outlet />;
}
export function SessionBar() {
  const { user, demo, logout } = useAuth();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!user && !demo && !failed) return null;
  return <aside className="session-bar" data-i18n="declarative" aria-label={t("auth.session")}>
    {user && <><bdi>{user.name}</bdi><Link to={roleHome(user.role)}>{t(`auth.${user.role}`)}</Link></>}
    {user?.role === "doctor" && <Link to="/doctor/patients">{t("doctor.patients")}</Link>}
    {demo && <span>{t("auth.demo")}</span>}
    {user && user.role !== "patient" && <Preferences />}
    {(user || demo) && <Button variant="ghost" disabled={busy} onClick={async () => {
      setBusy(true); setFailed(false);
      try { await logout(); } catch { setFailed(true); } finally { setBusy(false); }
    }}>{t(busy ? "auth.working" : "auth.logout")}</Button>}
    {failed && <p role="alert">{t("auth.logoutFailed")}</p>}
  </aside>;
}
