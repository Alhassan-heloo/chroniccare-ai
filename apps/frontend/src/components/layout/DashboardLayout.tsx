import { useState } from "react";
import { Outlet } from "react-router";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { BottomNav } from "./BottomNav";
import { DashboardContext } from "@/context/DashboardContext";
import { Modal } from "@/components/ui/Modal";
import { MeasurementForm } from "@/components/health/MeasurementForm";
export function DashboardLayout() {
  const [open, setOpen] = useState(false);
  return (
    <DashboardContext value={{ openMeasurement: () => setOpen(true) }}>
      <a className="skip-link" href="#main">
        تجاوز إلى المحتوى
      </a>
      <div className="dashboard-shell">
        <Sidebar />
        <div className="workspace">
          <Header />
          <main id="main" tabIndex={-1}>
            <Outlet />
          </main>
          <footer className="page-footer">
            ChronicCare AI <span>متابعة يومية، بخطوات بسيطة.</span>
          </footer>
        </div>
      </div>
      <BottomNav />
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="إضافة قراءة جديدة"
      >
        {open && <MeasurementForm onSaved={() => setOpen(false)} />}
      </Modal>
    </DashboardContext>
  );
}
