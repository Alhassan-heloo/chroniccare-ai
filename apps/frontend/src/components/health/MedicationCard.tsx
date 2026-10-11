import { Pill } from "lucide-react";
import { Link } from "react-router";
import type { MedicationSummary } from "@/lib/types/medication";
import { Button } from "@/components/ui/Button";
import { useSetDoseTaken } from "@/hooks/mutations/useMedicationMutations";
import { useI18n } from "@/i18n/context";
export function MedicationCard({
  medication,
}: {
  medication: MedicationSummary;
}) {
  const { t } = useI18n();
  const mutation = useSetDoseTaken();
  const next = medication.nextDose;
  return (
    <div className="task-row">
      <span className="icon-tile tone-success">
        <Pill />
      </span>
      <div className="task-copy">
        <h3>{medication.name}</h3>
        <p data-i18n="declarative">
          {next ? (
            <>
              {t("patient.overview.nextDose", { time: medication.time })}
            </>
          ) : medication.total ? (
            t("patient.overview.allTaken")
          ) : (
            t("patient.overview.addMedication")
          )}
        </p>
      </div>
      {next ? (
        <Button
          data-i18n="declarative"
          variant="secondary"
          disabled={mutation.isPending}
          onClick={() =>
            mutation.mutate({
              id: next.medicationId,
              time: next.time,
              taken: true,
            })
          }
        >
          {t("patient.overview.taken")}
        </Button>
      ) : (
        <Link className="btn btn-secondary" to="/patient/medications" data-i18n="declarative">
          {t("common.navigation.medications")}
        </Link>
      )}
    </div>
  );
}
