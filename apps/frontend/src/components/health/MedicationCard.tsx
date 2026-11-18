import { Check,Pill } from "lucide-react";
import {useState} from "react";
import { Link } from "react-router";
import type { MedicationSummary } from "@/lib/types/medication";
import { Button } from "@/components/ui/Button";
import { useSetDoseTaken } from "@/hooks/mutations/useMedicationMutations";
import { useI18n } from "@/i18n/context";
import { Feedback } from "@/components/ui/Feedback";
export function MedicationCard({
  medication,
}: {
  medication: MedicationSummary;
}) {
  const { t } = useI18n();
  const mutation = useSetDoseTaken();
  const next = medication.nextDose;
  const [last,setLast]=useState<{id:string;time:string;name:string}|null>(null);
  return (
    <div className="medication-next-dose">
    <div className="task-row">
      <span className="icon-tile tone-success">
        <Pill />
      </span>
      <div className="task-copy">
        <h3>{next ? <bdi>{medication.name}</bdi> : t(medication.total ? "finalExperience.allDoses" : "finalExperience.noDoses")}</h3>
        <p data-i18n="declarative">
          {next ? (
            <>
              {t("patient.overview.nextDose", { time: medication.time })}
              <span className="dose-recording-state">{t("finalExperience.pendingDose")}</span>
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
          loading={mutation.isPending}
          onClick={() =>
            mutation.mutate({
              id: next.medicationId,
              time: next.time,
              taken: true,
            },{onSuccess:()=>setLast({id:next.medicationId,time:next.time,name:medication.name})})
          }
        >
          {t("finalExperience.recordIntake")}
        </Button>
      ) : (
        <Link className="btn btn-secondary" to="/patient/medications" data-i18n="declarative">
          {t("common.navigation.medications")}
        </Link>
      )}
    </div>
    <progress className="today-dose-progress" value={medication.taken} max={Math.max(1,medication.total)} aria-label={t("doctor.dosesSummary",{taken:String(medication.taken),total:String(medication.total)})} />
    {last && <div className="dose-saved-notice" role="status"><span><Check size={17} aria-hidden="true" />{t("graduation.doseSaved")} · <bdi>{last.name}</bdi> · <bdi>{last.time}</bdi></span><Button variant="ghost" loading={mutation.isPending} onClick={()=>mutation.mutate({id:last.id,time:last.time,taken:false},{onSuccess:()=>setLast(null)})}>{t("graduation.undoDose")}</Button></div>}
    {mutation.isError && <Feedback kind="error">{t("validation.operationFailed")}</Feedback>}
    </div>
  );
}
