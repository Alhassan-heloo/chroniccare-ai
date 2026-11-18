import { Link } from "react-router";
import { useI18n } from "@/i18n/context";
import { BrandIdentity } from "@/components/ui/BrandIdentity";
export function Brand({ onClick }: { onClick?: () => void }) {
  const { t } = useI18n();
  return <Link to="/" className="brand" onClick={onClick} aria-label={t("common.layout.brandHome")} data-i18n="declarative">
    <BrandIdentity />
  </Link>;
}
