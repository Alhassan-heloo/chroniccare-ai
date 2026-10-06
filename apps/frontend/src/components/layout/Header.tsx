import { useState } from "react";
import { Bell, ChevronDown } from "lucide-react";
import { Link } from "react-router";
import { Brand } from "./Brand";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { usePatientDashboard } from "@/hooks/queries/usePatientDashboard";
export function Header() {
  const [open, setOpen] = useState(false);
  const { data } = usePatientDashboard();
  return (
    <header className="header">
      <div className="header-breadcrumb">
        مساحتي الصحية <span>/</span> متابعة يومية
      </div>
      <div className="mobile-brand">
        <Brand />
      </div>
      <div className="header-actions">
        <span className="demo-label">عرض تجريبي</span>
        <Button
          variant="ghost"
          aria-label="عرض التنبيهات"
          onClick={() => setOpen(true)}
        >
          <Bell size={22} />
        </Button>
        <Link to="/patient/profile" className="profile-link">
          <span className="avatar">م</span>
          <span className="profile-name">
            {data?.patient.name ?? "حسابي"}
            <small>حساب المريض</small>
          </span>
          <ChevronDown size={16} />
        </Link>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="التنبيهات">
        <p>
          {data?.reminder.title} — {data?.reminder.description}
        </p>
        <p className="muted">
          تنبيه تجريبي داخل التطبيق؛ الإشعارات الفعلية غير مفعلة.
        </p>
      </Modal>
    </header>
  );
}
