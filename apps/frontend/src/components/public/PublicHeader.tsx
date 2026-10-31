import { useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router";
import { LogOut, Menu, Pause, Play, X } from "lucide-react";
import { Preferences } from "@/components/layout/Preferences";
import { Button } from "@/components/ui/Button";
import { Feedback } from "@/components/ui/Feedback";
import { Mark } from "./living/ui";
import { useAuth } from "@/auth/context";
import { roleHome } from "@/auth/api";
import { useI18n } from "@/i18n/context";

export function PublicHeader({ paused = false, reduced = false, onMotion }: { paused?: boolean; reduced?: boolean; onMotion?: () => void }) {
  const { user, logout } = useAuth();
  const { t, direction } = useI18n();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false), [failed, setFailed] = useState(false), [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const close = () => setOpen(false);
  const motionLabel = t(reduced ? "public.living.motionReduced" : paused ? "public.living.motionResume" : "public.living.motionPause");
  function explore() {
    close();
    navigate(user ? roleHome(user.role) : "/login?returnTo=%2Fpatient%2Fdashboard");
  }
  return <>
    <a className="skip-link" href="#public-content" onClick={event => { event.preventDefault(); document.getElementById("public-content")?.focus(); }}>{t("common.layout.skip")}</a>
    <header className="topbar glass" onKeyDown={event => { if (event.key === "Escape" && open) { event.preventDefault(); close(); menuButton.current?.focus(); } }}>
      <Link className="brand" to="/" onClick={close} aria-label={`ChronicCare AI / ${t("public.living.home")}`}><Mark /><span dir="ltr">ChronicCare <b>AI</b><small dir={direction}>{t("public.living.interfaceLabel")}</small></span></Link>
      <button ref={menuButton} type="button" className="icon-button menu-toggle public-menu-toggle" aria-controls="public-navigation" aria-expanded={open} aria-label={t(open ? "public.next.closeMenu" : "public.next.menu")} onClick={() => setOpen(!open)}>{open ? <X size={21} aria-hidden="true" /> : <Menu size={21} aria-hidden="true" />}</button>
      <nav id="public-navigation" className={`navigation-panel ${open ? "open" : ""}`} aria-label={t("public.navigation")}>
        <div className="route-links"><NavLink to="/" end onClick={close}>{t("public.living.home")}</NavLink><Link to="/#features" onClick={close}>{t("public.living.explore")}</Link>{user ? <Link to={roleHome(user.role)} onClick={close}>{t(`auth.${user.role}`)}</Link> : <button type="button" disabled={busy} onClick={explore}>{t("public.living.openSpace")}</button>}</div>
        <div className="account-links public-account-nav">{user ? <Button variant="ghost" className="button quiet" disabled={busy} onClick={async () => { setBusy(true); setFailed(false); try { await logout(); close(); } catch { setFailed(true); } finally { setBusy(false); } }}><LogOut size={18} aria-hidden="true" />{t(busy ? "auth.working" : "auth.logout")}</Button> : <><Link className="login-action" to="/login" onClick={close}>{t("auth.signIn")}</Link><Link className="button secondary register-action" to="/register" onClick={close}>{t("auth.register")}</Link></>}</div>
      </nav>
      <div className="topbar-controls"><Preferences /><button type="button" className="icon-button motion-toggle" disabled={reduced} aria-label={motionLabel} title={motionLabel} aria-pressed={paused || reduced} onClick={onMotion}>{paused || reduced ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}</button></div>
    </header>
    {failed && <Feedback kind="error" className="header-feedback">{t("auth.logoutFailed")}</Feedback>}
  </>;
}
