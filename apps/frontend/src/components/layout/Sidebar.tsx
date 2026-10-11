import { NavLink } from "react-router";
import { ShieldCheck } from "lucide-react";
import { Brand } from "./Brand";
import { patientNavigation } from "./navigation";
import { useI18n } from "@/i18n/context";
export function Sidebar() {
  const { t } = useI18n();
  return (
    <aside className="sidebar">
      <Brand />
      <p className="nav-caption" data-i18n="declarative">{t("common.layout.caption")}</p>
      <nav aria-label={t("common.layout.mainNav")} data-i18n="declarative">
        {patientNavigation.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
          >
            <Icon size={21} />
            <span data-i18n="declarative">{t(label)}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-note" data-i18n="declarative">
        <ShieldCheck size={28} />
        <strong>{t("common.layout.start")}</strong>
        <p>
          {t("common.layout.noteFirst")}
          <br />
          {t("common.layout.noteLast")}
        </p>
      </div>
      <span className="sidebar-footer" data-i18n="declarative">ChronicCare AI · {t("common.layout.demoVersion")}</span>
    </aside>
  );
}
