import { HeartPulse, Droplet, Pencil, Trash2 } from "lucide-react";
import type { Measurement } from "@/lib/types/measurement";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useI18n } from "@/i18n/context";
export function MeasurementListCard({
  item,
  onEdit,
  onDelete,
}: {
  item: Measurement;
  onEdit: (item: Measurement) => void;
  onDelete: (item: Measurement) => void;
}) {
  const { t, formatDate, formatNumber, formatUnit } = useI18n();
  const pressure = item.kind === "bloodPressure";
  const Icon = pressure ? HeartPulse : Droplet;
  const label = t(pressure ? "measurements.bloodPressure" : "measurements.bloodGlucose");
  const timestamp = formatDate(item.recordedAt, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return (
    <Card className="measurement-entry" data-kind={item.kind} data-i18n="declarative">
      <div className="measurement-entry-heading">
        <span className="dashboard-feature-icon">
          <Icon size={20} aria-hidden="true" />
        </span>
        <div>
          <h3>{label}</h3>
          <time dateTime={item.recordedAt}>{timestamp}</time>
          {item.isExample && <Badge tone="info">{t("measurements.ui.example")}</Badge>}
        </div>
      </div>
      <div className="measurement-entry-value">
        <strong dir="ltr">{item.kind === "bloodPressure" ? `${formatNumber(item.systolic)}/${formatNumber(item.diastolic)}` : formatNumber(item.value)}</strong>
        <span dir="ltr">{formatUnit(pressure ? "mmHg" : "mg/dL")}</span>
      </div>
      <div className="measurement-entry-actions">
        <Button
          className="button"
          variant="secondary"
          onClick={() => onEdit(item)}
          aria-label={t("measurements.ui.editLabel", { kind: label, time: timestamp })}
        >
          <Pencil size={17} aria-hidden="true" />
          {t("common.actions.edit")}
        </Button>
        <Button
          className="button quiet delete-action"
          variant="ghost"
          onClick={() => onDelete(item)}
          aria-label={t("measurements.ui.deleteLabel", { kind: label, time: timestamp })}
        >
          <Trash2 size={17} aria-hidden="true" />
          {t("common.actions.delete")}
        </Button>
      </div>
    </Card>
  );
}
