import { NavLink } from "react-router";
import { PanelLeftClose, PanelLeftOpen, ShieldCheck } from "lucide-react";
import { roleNavigation } from "./navigation";
import type { User } from "@/lib/types/user";
import { useI18n } from "@/i18n/context";
import { Brand } from "./Brand";
export function Sidebar({ role = "patient", collapsed = false, onToggle }: { role?: User["role"]; collapsed?: boolean; onToggle?: () => void }) {
  const { t } = useI18n();
  return (
    <aside className="sidebar">
      <div className="sidebar-brand"><Brand living /></div>
      <div className="sidebar-section-heading"><p className="nav-caption" data-i18n="declarative">{t(`experience.roles.${role}`)}</p><button className="icon-button sidebar-toggle" type="button" onClick={onToggle} aria-label={t(collapsed ? "evolution.expandNav" : "evolution.collapseNav")} title={t(collapsed ? "evolution.expandNav" : "evolution.collapseNav")} aria-expanded={!collapsed} aria-controls="sidebar-navigation">{collapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}</button></div>
      <nav id="sidebar-navigation" aria-label={t("common.layout.mainNav")} data-i18n="declarative">
        {roleNavigation(role).map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            title={t(label)}
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
          >
            <Icon size={21} aria-hidden="true" />
            <span data-i18n="declarative">{t(label)}</span>
          </NavLink>
        ))}
      </nav>
      {role === "patient" && <div className="sidebar-note" data-i18n="declarative">
        <ShieldCheck size={28} />
        <strong>{t("common.layout.start")}</strong>
        <p>
          {t("common.layout.noteFirst")}
          <br />
          {t("common.layout.noteLast")}
        </p>
      </div>}
      <span className="sidebar-footer" data-i18n="declarative">ChronicCare AI · {t("common.layout.daily")}</span>
    </aside>
  );
}
