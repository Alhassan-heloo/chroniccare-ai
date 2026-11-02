import { useState } from "react";
import { NavLink, useLocation } from "react-router";
import { House, HeartPulse, Plus, Footprints, Menu } from "lucide-react";
import { useDashboardActions } from "@/context/DashboardContext";
import { Modal } from "@/components/ui/Modal";
import { patientNavigation } from "./navigation";
import { useI18n } from "@/i18n/context";
export function BottomNav() {
  const { t } = useI18n();
  const { openMeasurement } = useDashboardActions();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const secondary = patientNavigation.filter(item => !["/patient/dashboard", "/patient/measurements", "/patient/habits"].includes(item.to));
  return (
    <>
      <nav className="bottom-nav" aria-label={t("common.layout.mobileNav")} data-i18n="declarative">
        <NavLink to="/patient/dashboard">
          <House />
          <span>{t("common.navigation.home")}</span>
        </NavLink>
        <NavLink to="/patient/measurements">
          <HeartPulse />
          <span>{t("common.layout.health")}</span>
        </NavLink>
        <button
          className="add-nav"
          onClick={openMeasurement}
          aria-label={t("measurements.add")}
        >
          <Plus size={28} />
        </button>
        <NavLink to="/patient/habits">
          <Footprints />
          <span>{t("habits.title")}</span>
        </NavLink>
        <button
          className={secondary.some(item => pathname === item.to) ? "more-active" : undefined}
          onClick={() => setOpen(true)}
          aria-label={t("common.layout.showMore")}
          aria-expanded={open}
        >
          <Menu />
          <span>{t("common.layout.more")}</span>
        </button>
      </nav>
      <Modal open={open} onClose={() => setOpen(false)} title={t("common.layout.more")} declarativeTitle>
        <nav className="more-nav">
          {secondary.map((item) => (
            <NavLink key={item.to} to={item.to} onClick={() => setOpen(false)}>
              <item.icon size={20} aria-hidden="true" />
              <span data-i18n="declarative">{t(item.label)}</span>
            </NavLink>
          ))}
        </nav>
      </Modal>
    </>
  );
}
