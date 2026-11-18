import { useRef, useState } from "react";
import { Link } from "react-router";
import { LogOut, Menu, X } from "lucide-react";
import { PreferencesButton } from "@/components/layout/PreferencesButton";
import { Brand } from "@/components/layout/Brand";
import { Button } from "@/components/ui/Button";
import { Feedback } from "@/components/ui/Feedback";
import { useAuth } from "@/auth/context";
import { roleHome } from "@/auth/api";
import { useI18n } from "@/i18n/context";

const workspaceKeys = {
  patient: "common.workspace.patient",
  doctor: "common.workspace.doctor",
  admin: "common.workspace.admin",
} as const;

export function PublicHeader({ paused = false, reduced = false, onMotion, homepageDemoLabel }: {
  paused?: boolean; reduced?: boolean; onMotion?: () => void; homepageDemoLabel?: string;
}) {
  const { user, loading, logout } = useAuth();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const close = () => setOpen(false);
  const workspaceLabel = t(user ? workspaceKeys[user.role] : "common.workspace.guest");

  return <>
    <a className="skip-link" href="#public-content" onClick={event => {
      event.preventDefault();
      document.getElementById("public-content")?.focus();
    }}>{t("common.layout.skip")}</a>
    <header className={"public-header topbar" + (open ? " public-menu-open" : "")} onKeyDown={event => {
      if (event.key === "Escape" && open && !(event.target instanceof HTMLElement && event.target.closest("dialog"))) {
        event.preventDefault();
        close();
        menuButton.current?.focus();
      }
    }}>
      <Brand onClick={close} />
      <button ref={menuButton} type="button" className="icon-button menu-toggle public-menu-toggle" aria-controls="public-navigation" aria-expanded={open} aria-label={t(open ? "public.next.closeMenu" : "public.next.menu")} onClick={() => setOpen(!open)}>
        {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
      </button>
      <nav id="public-navigation" className={"navigation-panel" + (open ? " open" : "")} aria-label={t("public.navigation")}>
        <div className="route-links">
          <Link to="/" onClick={close}>{t("common.navigation.home")}</Link>
          <Link to={homepageDemoLabel ? "/#product-preview" : "/#features"} onClick={close}>
            {homepageDemoLabel ?? t("public.living.explore")}
          </Link>
          <Link to="/#assistant" onClick={close}>{t("common.navigation.assistant")}</Link>
        </div>
        <div className="account-links public-account-nav">
          {!loading && <Link className="login-action" to={user ? roleHome(user.role) : "/login"} onClick={close}>{workspaceLabel}</Link>}
          {!loading && !user && <Link className="btn btn-primary register-action" to="/register" onClick={close}>{t("auth.register")}</Link>}
          {user && <Button variant="ghost" disabled={busy} onClick={async () => {
            setBusy(true); setFailed(false);
            try { await logout(); close(); }
            catch { setFailed(true); }
            finally { setBusy(false); }
          }}><LogOut size={18} aria-hidden="true" />{t(busy ? "auth.working" : "auth.logout")}</Button>}
        </div>
      </nav>
      <div className="topbar-controls">
        <PreferencesButton motion={onMotion ? { paused, reduced, toggle: onMotion } : undefined} />
      </div>
    </header>
    {failed && <Feedback kind="error" className="header-feedback">{t("auth.logoutFailed")}</Feedback>}
  </>;
}
