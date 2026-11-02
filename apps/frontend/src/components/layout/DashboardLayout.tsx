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
import "@/styles/living-public.css";
import "@/styles/living-dashboard.css";
import "@/styles/living-measurements.css";
import "@/styles/living-medications.css";
import "@/styles/living-habits.css";
import "@/styles/living-reports.css";
import "@/styles/doctor.css";
import "@/styles/admin.css";
import "@/styles/living-assistant.css";
export function DashboardLayout({ role = "patient" }: { role?: User["role"] }) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const { pathname } = useLocation();
  // Only approved Phase 1E pages opt into the shared Living shell.
  const patientPath = pathname.replace(/\/$/, "");
  const measurements = role === "patient" && patientPath === "/patient/measurements";
  const medications = role === "patient" && patientPath === "/patient/medications";
  const habits = role === "patient" && patientPath === "/patient/habits";
  const reports = role === "patient" && patientPath === "/patient/reports";
  const admin = role === "admin" && patientPath === "/admin/dashboard";
  const assistant = role === "patient" && patientPath === "/patient/assistant";
  const living = admin || assistant || (role === "patient" && (patientPath === "/patient/dashboard" || measurements || medications || habits || reports));
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(() => { try { return localStorage.getItem("cc-public-motion") === "paused"; } catch { return false; } });
  useEffect(() => { if (living) { try { localStorage.setItem("cc-public-motion", paused ? "paused" : "running"); } catch { /* Optional visual preference. */ } } }, [living, paused]);
  return (
    <DashboardContext value={{ openMeasurement: () => setOpen(true) }}>
      <div className={living ? `living-public living-dashboard${assistant ? " living-assistant" : ""}${admin ? " living-admin" : ""}${measurements ? " living-measurements" : ""}${medications ? " living-medications" : ""}${habits ? " living-habits" : ""}${reports ? " living-reports" : ""}` : undefined} data-motion={living ? paused || reduced ? "paused" : "running" : undefined}>
      <a className="skip-link" href="#main" data-i18n="declarative">{t("common.layout.skip")}</a>
      <div className={`app-frame role-${role} clinical-app`}>
        <Header role={role} motion={living ? { paused, reduced, toggle: () => setPaused(value => !value) } : undefined} />
        <div className="clinical-app-body">
          <Sidebar role={role} />
          <div className="app-stage">
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
