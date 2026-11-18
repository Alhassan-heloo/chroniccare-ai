import { Link, NavLink, useLocation } from "react-router";
import { Brand } from "./Brand";
import { NotificationCenter } from "./NotificationCenter";
import { PreferencesButton, type MotionPreference } from "./PreferencesButton";
import { useI18n } from "@/i18n/context";
import { useAuth } from "@/auth/context";
import { SessionBar } from "@/auth/RouteAccess";
import { roleNavigation } from "./navigation";
import type { User } from "@/lib/types/user";
import { useMobileNavigationLayout } from "@/hooks/useMobileNavigationLayout";

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
export function Header({ role = "patient", motion }: { role?: User["role"]; motion?: MotionPreference }) {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const navigation = roleNavigation(role);
  const { ref: roleNav, expandedText } = useMobileNavigationLayout();
  const current = navigation.find(item => pathname === item.to || pathname.startsWith(`${item.to}/`));
  return <>
    <header className="header app-header">
      <Brand />
      <div className="header-breadcrumb" data-i18n="declarative"><span>{t(`experience.roles.${role}`)}</span><strong>{t(current?.label ?? `auth.${role}`)}</strong></div>
      <div className="header-actions"><PreferencesButton motion={motion} /><NotificationCenter />{role === "patient" && <PatientTools />}<SessionBar /></div>
    </header>
    {role !== "patient" && <nav ref={roleNav} className="role-mobile-nav" data-text-expanded={expandedText} aria-label={t("common.layout.mainNav")} data-i18n="declarative">{navigation.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to}><Icon size={18} aria-hidden="true" />{t(label)}</NavLink>)}</nav>}
  </>;
}
