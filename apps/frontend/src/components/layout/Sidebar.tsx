import { NavLink } from "react-router";
import { ShieldCheck } from "lucide-react";
import { roleNavigation } from "./navigation";
import type { User } from "@/lib/types/user";
import { useI18n } from "@/i18n/context";
import { Brand } from "./Brand";
export function Sidebar({ role = "patient" }: { role?: User["role"] }) {
  const { t } = useI18n();
  return (
    <aside className="sidebar">
      <div className="sidebar-brand"><Brand /></div>
      <p className="nav-caption" data-i18n="declarative">{t(`experience.roles.${role}`)}</p>
      <nav aria-label={t("common.layout.mainNav")} data-i18n="declarative">
        {roleNavigation(role).map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
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
