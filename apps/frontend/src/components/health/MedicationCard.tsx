import { Pill } from "lucide-react";
import { Link } from "react-router";
import type { MedicationSummary } from "@/lib/types/medication";
import { Button } from "@/components/ui/Button";
import { useSetDoseTaken } from "@/hooks/mutations/useMedicationMutations";
export function MedicationCard({
  medication,
}: {
  medication: MedicationSummary;
}) {
  const mutation = useSetDoseTaken();
  const next = medication.nextDose;
  return (
    <div className="task-row">
      <span className="icon-tile tone-success">
        <Pill />
      </span>
      <div className="task-copy">
        <h3>{medication.name}</h3>
        <p>
          {next ? (
            <>
              أول موعد غير مسجل اليوم: <bdi>{medication.time}</bdi>
            </>
          ) : medication.total ? (
            "تم تسجيل تناول جميع الجرعات"
          ) : (
            "أضف دواءك ومواعيده من صفحة أدويتي"
          )}
        </p>
      </div>
      {next ? (
        <Button
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
          تم التناول
        </Button>
      ) : (
        <Link className="btn btn-secondary" to="/patient/medications">
          أدويتي
        </Link>
      )}
    </div>
  );
}
