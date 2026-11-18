import { useState } from "react";
import { Plus, Pill, Info } from "lucide-react";
import type { Medication } from "@/lib/types/medication";
import { useMedications } from "@/hooks/queries/useMedications";
import { useDeleteMedication } from "@/hooks/mutations/useMedicationMutations";
import { summarizeMedications } from "@/lib/utils/medications";
import { MedicationForm } from "@/components/health/MedicationForm";
import { MedicationScheduleCard } from "@/components/health/MedicationScheduleCard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PatientPageHeader } from "@/components/layout/PatientPageHeader";
import { useI18n } from "@/i18n/context";
import "@/styles/evolution/records.css";
export default function MedicationsPage() {
  const { t, formatNumber, language } = useI18n();
  const { data = [], isPending, isError, refetch } = useMedications();
  const [form, setForm] = useState<Medication | "new" | null>(null);
  const [deleting, setDeleting] = useState<Medication | null>(null);
  const deletion = useDeleteMedication();
  const summary = summarizeMedications(data);
  return (
    <div className="medications-page records-page grid gap-6" data-i18n="declarative">
      <PatientPageHeader
        className="medications-heading"
        title={t("medications.title")}
        description={t("نظّم مواعيدك وسجّل الجرعات التي تناولتها.")}
        action={
          <Button onClick={() => setForm("new")}>
            <Plus size={18} aria-hidden="true" />
            {t("medications.add")}
          </Button>
        }
      />
      {isPending ? (
        <Card className="empty-state" role="status">
          {t("medications.persistence.loading")}
        </Card>
      ) : isError ? (
        <Card className="empty-state" role="alert">
          <p>{t("medications.persistence.loadError")}</p>
          <Button onClick={() => void refetch()}>{t("common.actions.retry")}</Button>
        </Card>
      ) : (
        <div className="records-medication-workspace">
          <section aria-labelledby="medication-schedule-heading">
          <div className="records-section-title"><h2 id="medication-schedule-heading">{language === "ar" ? "جدول أدويتك" : "Your medication schedule"}</h2></div>
          {data.length ? (
            <div className="medication-grid">
              {data.map((item) => (
                <MedicationScheduleCard
                  key={item.id}
                  item={item}
                  onEdit={setForm}
                  onDelete={setDeleting}
                />
              ))}
            </div>
          ) : (
            <Card className="empty-state measurement-empty glass">
              <Pill size={36} aria-hidden="true" />
              <h3>{t("medications.empty")}</h3>
              <p>{t("أضف دواءك ومواعيده وفق الوصفة.")}</p>
              <Button onClick={() => setForm("new")}>{t("إضافة أول دواء")}</Button>
            </Card>
          )}
          </section>
          {data.length > 0 && (
            <Card className="medication-summary glass">
              <h2>{t("medications.dosesTaken")}</h2>
              <div className="medication-summary-progress">
                <p role="status">
                  {t("medications.summary", { taken: formatNumber(summary.taken), total: formatNumber(summary.total), medications: formatNumber(data.length) })}
                </p>
                <progress aria-label={t("medications.dosesTaken")} value={summary.taken} max={summary.total || 1} />
              </div>
            </Card>
          )}
        </div>
      )}
      <p className="dashboard-disclosure" data-i18n="declarative">
        <Info size={18} aria-hidden="true" />
        <span>{t("medications.persistence.notice")}</span>
      </p>
      <Modal
        open={form !== null}
        onClose={() => setForm(null)}
        title={t(form === "new" ? "medications.add" : "medications.edit")}
        declarativeTitle
      >
        {form && (
          <MedicationForm
            key={form === "new" ? "new" : form.id}
            initial={form === "new" ? undefined : form}
            onSaved={() => setForm(null)}
          />
        )}
      </Modal>
      <Modal
        open={!!deleting}
        onClose={() => {
          if (!deletion.isPending) setDeleting(null);
        }}
        title={t("medications.deleteTitle")}
        declarativeTitle
      >
        {deleting && (
          <div className="stack">
            <p data-i18n="declarative">
              {t("medications.persistence.deleteQuestion", { name: deleting.name })}
            </p>
            <div className="confirmation-actions">
              <Button
                data-i18n="declarative"
                autoFocus
                variant="secondary"
                disabled={deletion.isPending}
                onClick={() => setDeleting(null)}
              >
                {t("common.actions.cancel")}
              </Button>
              <Button
                data-i18n="declarative"
                variant="danger"
                disabled={deletion.isPending}
                onClick={() =>
                  deletion.mutate(deleting.id, {
                    onSuccess: () => setDeleting(null),
                  })
                }
              >
                {t(deletion.isPending ? "measurements.ui.deleting" : "measurements.ui.confirmDelete")}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
