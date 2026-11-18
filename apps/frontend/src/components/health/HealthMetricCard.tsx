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
  recordedAt,
  progress,
}: {
  label: string;
  value: string;
  unit: string;
  icon: LucideIcon;
  tone: "danger" | "info" | "warning" | "success";
  status?: string;
  recordedAt?: string;
  progress?: number;
}) {
  const { t, formatNumber, formatDate, formatTime } = useI18n();
  return (
    <Card className="metric-card">
      <div className="metric-heading">
        <span className={`icon-tile tone-${tone}`} aria-hidden="true">
          <Icon size={24} />
        </span>
        <h3>{label}</h3>
      </div>
      <div className="metric-reading">
        <bdi className="metric-number" dir="ltr">{value}</bdi>
        {unit && <span className="metric-unit patient-reading-unit"><bdi>{unit}</bdi></span>}
      </div>
      {recordedAt && (
        <time className="metric-time patient-reading-time" dateTime={recordedAt}>
          <bdi>{formatDate(recordedAt, { day: "numeric", month: "long", year: "numeric" })}</bdi>
          <bdi>{formatTime(recordedAt)}</bdi>
        </time>
      )}
      {status ? (
        <Badge tone="info">{status}</Badge>
      ) : progress !== undefined && (
        <div className="metric-progress">
          <progress value={progress} max={100} aria-label={t("patient.metric.progress", { label })} />
          <span>{t("patient.metric.goal", { value: formatNumber(progress ?? 0) })}</span>
        </div>
      )}
    </Card>
  );
}
