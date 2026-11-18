import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { BottomNav } from "./BottomNav";
import { DashboardContext } from "@/context/DashboardContext";
import { Modal } from "@/components/ui/Modal";
import { MeasurementForm } from "@/components/health/MeasurementForm";
import { useI18n } from "@/i18n/context";
import type { User } from "@/lib/types/user";
import { useReducedMotion } from "@/components/public/living/useLivingMotion";
export function DashboardLayout({ role = "patient" }: { role?: User["role"] }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem("cc-sidebar-collapsed") === "true"; } catch { return false; } });
  const { t } = useI18n();
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) return;
    window.scrollTo({ top: 0, behavior: "instant" });
    document.getElementById("main")?.focus({ preventScroll: true });
  }, [pathname, hash]);
  useEffect(() => { try { localStorage.setItem("cc-sidebar-collapsed", String(collapsed)); } catch { /* Optional navigation preference. */ } }, [collapsed]);
  const patientPath = pathname.replace(/\/$/, "");
  const measurements = role === "patient" && patientPath === "/patient/measurements";
  const hasReadingHeader = measurements || (role === "patient" && patientPath === "/patient/dashboard");
  const medications = role === "patient" && patientPath === "/patient/medications";
  const habits = role === "patient" && patientPath === "/patient/habits";
  const reports = role === "patient" && patientPath === "/patient/reports";
  const admin = role === "admin" && patientPath === "/admin/dashboard";
  const assistant = role === "patient" && patientPath === "/patient/assistant";
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(() => { try { return localStorage.getItem("cc-public-motion") === "paused"; } catch { return false; } });
  useEffect(() => { try { localStorage.setItem("cc-public-motion", paused ? "paused" : "running"); } catch { /* Optional visual preference. */ } }, [paused]);
  return (
    <DashboardContext value={{ openMeasurement: () => setOpen(true) }}>
      <div className={`living-evolution living-public living-dashboard experience-shell experience-${role}${hasReadingHeader ? " patient-reading-shell" : ""}${assistant ? " living-assistant" : ""}${admin ? " living-admin" : ""}${measurements ? " living-measurements" : ""}${medications ? " living-medications" : ""}${habits ? " living-habits" : ""}${reports ? " living-reports" : ""}`} data-motion={paused || reduced ? "paused" : "running"}>
      <a className="skip-link" href="#main" data-i18n="declarative">{t("common.layout.skip")}</a>
      <div className={`app-frame role-${role} clinical-app`} data-nav={collapsed ? "collapsed" : "expanded"}>
        <div className="clinical-app-body">
          <Sidebar role={role} collapsed={collapsed} onToggle={() => setCollapsed(value => !value)} />
          <div className="app-stage">
            <Header role={role} motion={{ paused, reduced, toggle: () => setPaused(value => !value) }} />
            <div className="dashboard-shell"><div className="workspace">
              <main id="main" tabIndex={-1}><Outlet /></main>
              <footer className="page-footer" data-i18n="declarative">ChronicCare AI <span>{t("common.layout.footer")}</span></footer>
            </div></div>
          </div>
        </div>
        {role === "patient" && <BottomNav />}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={t("measurements.add")} declarativeTitle>
        {open && <MeasurementForm onSaved={() => setOpen(false)} />}
      </Modal>
      </div>
    </DashboardContext>
  );
}
