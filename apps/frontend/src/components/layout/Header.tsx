import { useState } from "react";
import { Pause, Play, SlidersHorizontal } from "lucide-react";
import { Link, NavLink, useLocation } from "react-router";
import { Brand } from "./Brand";
import { NotificationCenter } from "./NotificationCenter";
import { Preferences } from "./Preferences";
import { useI18n } from "@/i18n/context";
import { useAuth } from "@/auth/context";
import { SessionBar } from "@/auth/RouteAccess";
import { roleNavigation } from "./navigation";
import type { User } from "@/lib/types/user";
import { Modal } from "@/components/ui/Modal";

function PatientTools() {
  const { user } = useAuth();
  const { t } = useI18n();
  return <>
    <Link to="/patient/profile" className="profile-link" aria-label={t("common.navigation.profile")} data-i18n="declarative">
      <span className="avatar" aria-hidden="true">{(user?.name ?? "C").slice(0,1)}</span>
      <span className="profile-name"><bdi>{user?.name}</bdi><small>{t("experience.roles.patient")}</small></span>
    </Link>
  </>;
}
export function Header({ role = "patient", motion }: { role?: User["role"]; motion?: { paused: boolean; reduced: boolean; toggle: () => void } }) {
  const { t, language } = useI18n();
  const [settings, setSettings] = useState(false);
  const settingsLabel = language === "ar" ? "اللغة والمظهر" : "Language & appearance";
  const { pathname } = useLocation();
  const navigation = roleNavigation(role);
  const current = navigation.find(item => pathname === item.to || pathname.startsWith(`${item.to}/`));
  const motionLabel = t(motion?.reduced ? "public.living.motionReduced" : motion?.paused ? "public.living.motionResume" : "public.living.motionPause");
  return <>
    <header className="header app-header">
      <Brand living={Boolean(motion)} />
      <div className="header-breadcrumb" data-i18n="declarative"><span>{t(`experience.roles.${role}`)}</span><strong>{t(current?.label ?? `auth.${role}`)}</strong></div>
      <div className="header-actions"><button className="icon-button header-preferences-button" type="button" onClick={() => setSettings(true)} aria-label={settingsLabel} title={settingsLabel} aria-haspopup="dialog" aria-expanded={settings}><SlidersHorizontal size={20} aria-hidden="true" /></button><NotificationCenter />{role === "patient" && <PatientTools />}<SessionBar /></div>
    </header>
    {role !== "patient" && <nav className="role-mobile-nav" aria-label={t("common.layout.mainNav")} data-i18n="declarative">{navigation.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to}><Icon size={18} aria-hidden="true" />{t(label)}</NavLink>)}</nav>}
    <Modal open={settings} onClose={() => setSettings(false)} title={settingsLabel} declarativeTitle><div className="workspace-preferences"><Preferences />{motion && <button type="button" className="btn btn-secondary motion-toggle" disabled={motion.reduced} aria-label={motionLabel} aria-pressed={motion.paused || motion.reduced} onClick={motion.toggle}>{motion.paused || motion.reduced ? <Play size={17} aria-hidden="true" /> : <Pause size={17} aria-hidden="true" />}{motionLabel}</button>}</div></Modal>
  </>;
}
