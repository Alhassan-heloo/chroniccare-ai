import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useI18n } from "@/i18n/context";
import { ReadingValue } from "./ReadingValue";
import {Check} from "lucide-react";
export function HealthMetricCard({
  label,
  value,
  unit,
  icon: Icon,
  tone,
  status,
  recordedAt,
  progress,
  saved=false,
}: {
  label: string;
  value: string;
  unit: string;
  icon: LucideIcon;
  tone: "danger" | "info" | "warning" | "success";
  status?: string;
  recordedAt?: string;
  progress?: number;
  saved?: boolean;
}) {
  const { t, formatNumber } = useI18n();
  return (
    <Card className={"metric-card"+(saved?" reading-just-saved":"")}>
      <div className="metric-heading">
        <span className={`icon-tile tone-${tone}`} aria-hidden="true">
          <Icon size={24} />
        </span>
        <h3>{label}</h3>
      </div>
      <ReadingValue value={value} unit={unit} recordedAt={recordedAt} />
      {saved && <p className="reading-saved-label" role="status"><Check size={17} aria-hidden="true" />{t("graduation.readingSaved")}</p>}
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
