import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
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
        <Badge tone={status.includes("طبيعي") ? "success" : "info"}>
          {status}
        </Badge>
      ) : (
        <div className="metric-progress">
          <progress value={progress} max={100} aria-label={`تقدم ${label}`} />
          <span>{progress}% من هدف اليوم</span>
        </div>
      )}
    </Card>
  );
}
