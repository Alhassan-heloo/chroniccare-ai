import { HeartPulse, Droplet, Pencil, Trash2 } from "lucide-react";
import type { Measurement } from "@/lib/types/measurement";
import {
  measurementLabel,
  measurementValue,
} from "@/lib/utils/measurementFilters";
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
  const { locale } = useI18n();
  const pressure = item.kind === "bloodPressure";
  const Icon = pressure ? HeartPulse : Droplet;
  const timestamp = new Date(item.recordedAt).toLocaleString(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return (
    <Card className="measurement-entry">
      <div className="measurement-entry-heading">
        <span className={`icon-tile ${pressure ? "tone-danger" : "tone-info"}`}>
          <Icon />
        </span>
        <div>
          <h3>{measurementLabel(item)}</h3>
          <time dateTime={item.recordedAt}>{timestamp}</time>
          {item.isExample && <Badge tone="info">بيانات مثال</Badge>}
        </div>
      </div>
      <div className="measurement-entry-value">
        <strong dir="ltr">{measurementValue(item)}</strong>
        <span dir="ltr">{pressure ? "mmHg" : "mg/dL"}</span>
      </div>
      <div className="measurement-entry-actions">
        <Button
          variant="secondary"
          onClick={() => onEdit(item)}
          aria-label={`تعديل قراءة ${measurementLabel(item)} ${timestamp}`}
        >
          <Pencil size={17} />
          تعديل
        </Button>
        <Button
          className="delete-action"
          variant="ghost"
          onClick={() => onDelete(item)}
          aria-label={`حذف قراءة ${measurementLabel(item)} ${timestamp}`}
        >
          <Trash2 size={17} />
          حذف
        </Button>
      </div>
    </Card>
  );
}
