import { useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "./context";
import { authRequest } from "./api";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { roleHome } from "./api";
import type { User } from "@/lib/types/user";
import { useI18n } from "@/i18n/context";
import { Button } from "@/components/ui/Button";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { Feedback } from "@/components/ui/Feedback";

export function ProtectedRoute({ role }: { role: User["role"] }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { t } = useI18n();
  if (loading) return <Feedback kind="loading">{t("auth.working")}</Feedback>;
  if (!user) return <Navigate replace to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search + location.hash)}`} />;
  if (user.role !== role) return <Navigate replace to={roleHome(user.role)} />;
  if (user.mustChangePassword) return <ChangeTemporaryPassword />;
  return <Outlet />;
}
export function SessionBar() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!user && !failed) return null;
  return <aside className="session-bar" data-i18n="declarative" aria-label={t("auth.session")}>
    {user && user.role !== "patient" && <bdi className="session-identity">{user.name}</bdi>}
    {user && <Button variant="ghost" disabled={busy} aria-busy={busy} aria-label={t(busy ? "auth.working" : "auth.logout")} title={t("auth.logout")} onClick={async () => {
      setBusy(true); setFailed(false);
      try { await logout(); } catch {
        setFailed(true);
        // Local logout can unmount this protected header before the rejection.
        // The application-wide toaster survives the redirect to the login page.
        toast.warning(t("auth.logoutFailed"), { duration: 10000 });
      } finally { setBusy(false); }
    }}><LogOut size={20} aria-hidden="true" /><span className="session-logout-text">{t(busy ? "auth.working" : "auth.logout")}</span></Button>}
    {failed && <p role="alert">{t("auth.logoutFailed")}</p>}
  </aside>;
}

function ChangeTemporaryPassword() {
 const {t}=useI18n(), {logout}=useAuth();
 const [current,setCurrent]=useState(""),[password,setPassword]=useState(""),[confirm,setConfirm]=useState(""),[busy,setBusy]=useState(false),[failed,setFailed]=useState(false);
 return <Card><h1>{t("admin.changeRequired")}</h1><form onSubmit={async event=>{event.preventDefault();if(busy)return;setFailed(false);if(password!==confirm || current===password){setFailed(true);return;}setBusy(true);try{await authRequest("change-password",{body:{currentPassword:current,password}});await logout().catch(()=>undefined);}catch{setFailed(true);}finally{setBusy(false);}}}>
 <Input label={t("admin.currentPassword")} type="password" autoComplete="current-password" value={current} onChange={e=>setCurrent(e.target.value)} required />
 <Input label={t("admin.newPassword")} type="password" autoComplete="new-password" minLength={12} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} required />
 <Input label={t("admin.confirmPassword")} type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} required />
 {failed && <Feedback kind="error">{t("admin.passwordFailed")}</Feedback>}
 <Button type="submit" loading={busy}>{t("admin.changePassword")}</Button>
 </form></Card>;
}
