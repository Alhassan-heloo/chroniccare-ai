import { HeartPulse } from "lucide-react";
import { Link } from "react-router";
import { useI18n } from "@/i18n/context";
import { Mark } from "@/components/public/living/ui";
export function Brand({ living = false }: { living?: boolean }) {
  const { t } = useI18n();
  return (
    <Link to="/" className="brand" aria-label={t("common.layout.brandHome")} data-i18n="declarative">
      {living ? <Mark /> : <span className="brand-icon">
        <HeartPulse size={27} />
      </span>}
      <span dir="ltr">
        ChronicCare <b>AI</b>
        <small>{t(living ? "common.layout.caption" : "common.layout.brandTagline")}</small>
      </span>
    </Link>
  );
}
