import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useI18n } from "@/i18n/context";
export function HealthMetricCard({
  label,
  value,
  unit,
  icon: Icon,
  tone,
  status,
  progress,
}: {
  label: string;
  value: string;
  unit: string;
  icon: LucideIcon;
  tone: "danger" | "info" | "warning" | "success";
  status?: string;
  progress?: number;
}) {
  const { t, formatNumber } = useI18n();
  return (
    <Card className="metric-card">
      <div className="metric-heading">
        <span className={`icon-tile tone-${tone}`}>
          <Icon size={24} />
        </span>
        <h2>{label}</h2>
      </div>
      <div className="metric-number" dir="ltr">
        {value}
      </div>
      <div className="metric-unit">{unit}</div>
      {status ? (
        <Badge tone="info">{status}</Badge>
      ) : (
        <div className="metric-progress">
          <progress value={progress} max={100} aria-label={t("patient.metric.progress", { label })} />
          <span>{t("patient.metric.goal", { value: formatNumber(progress ?? 0) })}</span>
        </div>
      )}
    </Card>
  );
}
