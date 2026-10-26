import { Pill, Pencil, Trash2, Check } from "lucide-react";
import type { Medication } from "@/lib/types/medication";
import { todayKey } from "@/lib/utils/medications";
import { useSetDoseTaken } from "@/hooks/mutations/useMedicationMutations";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n/context";
export function MedicationScheduleCard({
  item,
  onEdit,
  onDelete,
}: {
  item: Medication;
  onEdit: (item: Medication) => void;
  onDelete: (item: Medication) => void;
}) {
  const { t, formatNumber } = useI18n();
  const mutation = useSetDoseTaken();
  const taken = item.doses.filter((dose) => dose.takenOn === todayKey()).length;
  return (
    <Card className="medication-schedule">
      <div className="medication-card-heading">
        <span className="icon-tile tone-success">
          <Pill />
        </span>
        <div className="medication-title">
          <h2>{item.name}</h2>
          <p>الجرعة: {item.dosage}</p>
        </div>
        <Badge tone={taken === item.doses.length ? "success" : "info"} data-i18n="declarative">
          {t("medications.recorded", { taken: formatNumber(taken), total: formatNumber(item.doses.length) })}
        </Badge>
      </div>
      {item.notes && <p className="medication-notes">{item.notes}</p>}
      <ul className="dose-list">
        {item.doses.map((dose) => {
          const done = dose.takenOn === todayKey();
          return (
            <li key={dose.time}>
              <div>
                <time dir="ltr">{dose.time}</time>
                <span>{done ? "✓ تم تسجيل التناول" : "لم يُسجّل التناول"}</span>
              </div>
              <Button
                variant={done ? "secondary" : "primary"}
                disabled={mutation.isPending}
                aria-pressed={done}
                aria-label={`${done ? "إلغاء تسجيل تناول" : "تسجيل تناول"} ${item.name} الساعة ${dose.time}`}
                onClick={() =>
                  mutation.mutate({
                    id: item.id,
                    time: dose.time,
                    taken: !done,
                  })
                }
              >
                {done ? (
                  <>
                    <Check size={17} />
                    إلغاء التسجيل
                  </>
                ) : (
                  "تم التناول"
                )}
              </Button>
            </li>
          );
        })}
      </ul>
      <div className="medication-card-actions">
        <Button
          variant="secondary"
          onClick={() => onEdit(item)}
          aria-label={`تعديل ${item.name}`}
        >
          <Pencil size={17} />
          تعديل
        </Button>
        <Button
          variant="ghost"
          className="delete-action"
          onClick={() => onDelete(item)}
          aria-label={`حذف ${item.name}`}
        >
          <Trash2 size={17} />
          حذف
        </Button>
      </div>
    </Card>
  );
}
