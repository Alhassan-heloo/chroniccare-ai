import { Pencil, Trash2, Check } from "lucide-react";
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
  const today = todayKey();
  const taken = item.doses.filter((dose) => dose.takenOn === today).length;
  return (
    <Card className="medication-schedule glass" data-i18n="declarative">
      <div className="medication-card-heading">
        <div className="medication-title">
          <h3><bdi>{item.name}</bdi></h3>
          {item.dosage && <p className="medication-dosage"><span>{t("الجرعة")}</span><bdi>{item.dosage}</bdi></p>}
        </div>
        {item.doses.length > 0 && <Badge tone={taken === item.doses.length ? "success" : "info"}>
          {t("medications.recorded", { taken: formatNumber(taken), total: formatNumber(item.doses.length) })}
        </Badge>}
      </div>
      {item.doses.length > 0 && <ul className="dose-list">
        {item.doses.map((dose) => {
          const done = dose.takenOn === today;
          return (
            <li key={dose.time}>
              <div>
                <time dateTime={dose.time}><bdi dir="ltr">{dose.time}</bdi></time>
                <span>{t(done ? "تم تسجيل التناول" : "لم يُسجّل التناول")}</span>
              </div>
              <Button
                className="button dose-action"
                variant={done ? "secondary" : "primary"}
                disabled={mutation.isPending}
                aria-pressed={done}
                aria-label={t(done ? "medications.undoDoseLabel" : "medications.recordDoseLabel", { name: `\u2068${item.name}\u2069`, time: `\u2068${dose.time}\u2069` })}
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
                    <Check size={17} aria-hidden="true" />
                    {t("إلغاء التسجيل")}
                  </>
                ) : (
                  t("تم التناول")
                )}
              </Button>
            </li>
          );
        })}
      </ul>}
      {item.notes && <p className="medication-notes"><bdi>{item.notes}</bdi></p>}
      <div className="medication-card-actions">
        <Button
          className="button"
          variant="secondary"
          onClick={() => onEdit(item)}
          aria-label={t("medications.editItemLabel", { name: `\u2068${item.name}\u2069` })}
        >
          <Pencil size={17} aria-hidden="true" />
          {t("common.actions.edit")}
        </Button>
        <Button
          variant="ghost"
          className="delete-action"
          onClick={() => onDelete(item)}
          aria-label={t("medications.deleteItemLabel", { name: `\u2068${item.name}\u2069` })}
        >
          <Trash2 size={17} aria-hidden="true" />
          {t("common.actions.delete")}
        </Button>
      </div>
    </Card>
  );
}
