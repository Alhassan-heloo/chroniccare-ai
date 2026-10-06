import { Construction } from "lucide-react";
import { Link } from "react-router";
import { Card } from "./Card";
export function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className="placeholder">
      <span className="icon-tile tone-info">
        <Construction size={30} />
      </span>
      <span className="eyebrow">المرحلة القادمة</span>
      <h1>{title}</h1>
      <p>{description}</p>
      <Link to="/patient/dashboard" className="btn btn-primary">
        العودة إلى لوحة المريض
      </Link>
    </Card>
  );
}
