import { useState } from "react";
import { NavLink } from "react-router";
import { House, HeartPulse, Plus, Bot, Menu } from "lucide-react";
import { useDashboardActions } from "@/context/DashboardContext";
import { Modal } from "@/components/ui/Modal";
import { patientNavigation } from "./navigation";
export function BottomNav() {
  const { openMeasurement } = useDashboardActions();
  const [open, setOpen] = useState(false);
  return (
    <>
      <nav className="bottom-nav" aria-label="التنقل على الجوال">
        <NavLink to="/patient/dashboard">
          <House />
          <span>الرئيسية</span>
        </NavLink>
        <NavLink to="/patient/measurements">
          <HeartPulse />
          <span>صحتي</span>
        </NavLink>
        <button
          className="add-nav"
          onClick={openMeasurement}
          aria-label="إضافة قراءة جديدة"
        >
          <Plus size={28} />
        </button>
        <NavLink to="/patient/assistant">
          <Bot />
          <span>المساعد</span>
        </NavLink>
        <button
          onClick={() => setOpen(true)}
          aria-label="عرض المزيد من الصفحات"
        >
          <Menu />
          <span>المزيد</span>
        </button>
      </nav>
      <Modal open={open} onClose={() => setOpen(false)} title="المزيد">
        <nav className="more-nav">
          {patientNavigation.slice(2).map((item) => (
            <NavLink key={item.to} to={item.to} onClick={() => setOpen(false)}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </Modal>
    </>
  );
}
