import { useState } from "react";
import { Outlet } from "react-router";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { BottomNav } from "./BottomNav";
import { DashboardContext } from "@/context/DashboardContext";
import { Modal } from "@/components/ui/Modal";
import { MeasurementForm } from "@/components/health/MeasurementForm";
import { useI18n } from "@/i18n/context";
export function DashboardLayout() {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  return (
    <DashboardContext value={{ openMeasurement: () => setOpen(true) }}>
      <a className="skip-link" href="#main" data-i18n="declarative">
        {t("common.layout.skip")}
      </a>
      <div className="dashboard-shell">
        <Sidebar />
        <div className="workspace">
          <Header />
          <main id="main" tabIndex={-1}>
            <Outlet />
          </main>
          <footer className="page-footer" data-i18n="declarative">
            ChronicCare AI <span>{t("common.layout.footer")}</span>
          </footer>
        </div>
      </div>
      <BottomNav />
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("measurements.add")}
        declarativeTitle
      >
        {open && <MeasurementForm onSaved={() => setOpen(false)} />}
      </Modal>
    </DashboardContext>
  );
}
