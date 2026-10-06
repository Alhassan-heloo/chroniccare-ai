import { NavLink } from "react-router";
import { ShieldCheck } from "lucide-react";
import { Brand } from "./Brand";
import { patientNavigation } from "./navigation";
export function Sidebar() {
  return (
    <aside className="sidebar">
      <Brand />
      <p className="nav-caption">مساحتك الصحية</p>
      <nav aria-label="القائمة الرئيسية">
        {patientNavigation.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
          >
            <Icon size={21} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-note">
        <ShieldCheck size={28} />
        <strong>صحتك تبدأ بخطوة</strong>
        <p>
          متابعة بسيطة كل يوم،
          <br />
          واهتمام يدوم.
        </p>
      </div>
      <span className="sidebar-footer">ChronicCare AI · نسخة تجريبية</span>
    </aside>
  );
}
