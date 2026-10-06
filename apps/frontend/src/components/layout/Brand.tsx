import { HeartPulse } from "lucide-react";
import { Link } from "react-router";
export function Brand() {
  return (
    <Link to="/" className="brand" aria-label="ChronicCare AI، الصفحة الرئيسية">
      <span className="brand-icon">
        <HeartPulse size={27} />
      </span>
      <span dir="ltr">
        ChronicCare <b>AI</b>
        <small>معًا نحو حياة أكثر صحة</small>
      </span>
    </Link>
  );
}
