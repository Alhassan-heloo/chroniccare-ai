import { useState } from "react";
import { Bell } from "lucide-react";
import { Link, NavLink, useLocation } from "react-router";
import { Brand } from "./Brand";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { usePatientDashboard } from "@/hooks/queries/usePatientDashboard";
import { Preferences } from "./Preferences";
import { useI18n } from "@/i18n/context";
import { useAuth } from "@/auth/context";
import { SessionBar } from "@/auth/RouteAccess";
import { roleNavigation } from "./navigation";
import type { User } from "@/lib/types/user";

function PatientTools() {
  const { user } = useAuth();
  const { data } = usePatientDashboard();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return <>
    <Button variant="ghost" aria-label={t("common.layout.showNotifications")} onClick={() => setOpen(true)} data-i18n="declarative"><Bell size={21} aria-hidden="true" /></Button>
    <Link to="/patient/profile" className="profile-link" aria-label={t("common.navigation.profile")} data-i18n="declarative">
      <span className="avatar" aria-hidden="true">{(user?.name ?? data?.patient.name ?? "C").slice(0,1)}</span>
      <span className="profile-name"><bdi>{user?.name ?? data?.patient.name}</bdi><small>{t("auth.patient")}</small></span>
    </Link>
    <Modal open={open} onClose={() => setOpen(false)} title={t("common.layout.notifications")} declarativeTitle>
      <p data-i18n={data?.reminder.id === "glucose-reminder" ? "declarative" : undefined}>{data?.reminder.id === "glucose-reminder" ? <>{t("common.reminder.glucose")} — {t("common.reminder.evening")}</> : <>{data?.reminder.title} — {data?.reminder.description}</>}</p>
      <p className="muted" data-i18n="declarative">{t("common.layout.notificationDemo")}</p>
    </Modal>
  </>;
}
export function Header({ role = "patient" }: { role?: User["role"] }) {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const navigation = roleNavigation(role);
  const current = navigation.find(item => pathname === item.to);
  return <>
    <header className="header app-header">
      <Brand />
      <div className="header-breadcrumb" data-i18n="declarative"><span>{t(`auth.${role}`)}</span><strong>{t(current?.label ?? `auth.${role}`)}</strong></div>
      <div className="header-actions"><Preferences />{role === "patient" && <PatientTools />}<SessionBar /></div>
    </header>
    {role !== "patient" && <nav className="role-mobile-nav" aria-label={t("common.layout.mainNav")} data-i18n="declarative">{navigation.map(item => <NavLink key={item.to} to={item.to}>{t(item.label)}</NavLink>)}</nav>}
  </>;
}
