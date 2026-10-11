import { HeartPulse } from "lucide-react";
import { Link } from "react-router";
import { useI18n } from "@/i18n/context";
export function Brand() {
  const { t } = useI18n();
  return (
    <Link to="/" className="brand" aria-label={t("common.layout.brandHome")} data-i18n="declarative">
      <span className="brand-icon">
        <HeartPulse size={27} />
      </span>
      <span dir="ltr">
        ChronicCare <b>AI</b>
        <small>{t("common.layout.brandTagline")}</small>
      </span>
    </Link>
  );
}
