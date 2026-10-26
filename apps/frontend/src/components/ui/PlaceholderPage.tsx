import { Construction } from "lucide-react";
import { Link } from "react-router";
import { Card } from "./Card";
import { useAuth } from "@/auth/context";
import { roleHome } from "@/auth/api";
import { useI18n } from "@/i18n/context";
export function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const { user } = useAuth();
  const { t } = useI18n();
  const role = user?.role ?? "patient";
  return (
    <Card className="placeholder">
      <span className="icon-tile tone-info">
        <Construction size={30} />
      </span>
      <span className="eyebrow">المرحلة القادمة</span>
      <h1>{title}</h1>
      <p>{description}</p>
      <Link to={roleHome(role)} className="btn btn-primary" data-i18n="declarative">
        {t(`auth.${role}`)}
      </Link>
    </Card>
  );
}
