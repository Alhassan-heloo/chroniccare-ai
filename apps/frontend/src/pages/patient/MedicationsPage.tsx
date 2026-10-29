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
import { useI18n } from "@/i18n/context";
import { SignatureArtwork, LivingPulse } from "@/components/public/living/ui";
import { useAuth } from "@/auth/context";
export default function MedicationsPage() {
  const { t, formatNumber } = useI18n();
  const { demo } = useAuth();
  const { data = [], isPending, isError, refetch } = useMedications();
  const [form, setForm] = useState<Medication | "new" | null>(null);
  const [deleting, setDeleting] = useState<Medication | null>(null);
  const deletion = useDeleteMedication();
  const summary = summarizeMedications(data);
  return (
    <div className="stack medications-page">
      <div className="medications-heading dashboard-welcome">
        <SignatureArtwork />
        <div data-i18n="declarative">
          <span className="eyebrow">{t("روتينك اليومي، في مكان واحد")}</span>
          <h1>{t("medications.title")}</h1>
          <p>{t("نظّم مواعيدك وسجّل الجرعات التي تناولتها.")}</p>
        </div>
      </div>
      <div className="medications-actions dashboard-canvas-actions">
        <Button onClick={() => setForm("new")} data-i18n="declarative">
          <Plus size={19} aria-hidden="true" />
          {t("medications.add")}
        </Button>
      </div>
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
        <>
          <Card className="medication-summary glass">
            <LivingPulse cue={`${summary.taken}:${summary.total}`} />
            <div className="dashboard-panel-heading">
              <span className="dashboard-feature-icon" aria-hidden="true"><Pill size={20} /></span>
              <h2>متابعة جرعات اليوم</h2>
            </div>
            <div className="medication-summary-progress">
              <p aria-live="polite" data-i18n="declarative">
                {t("medications.summary", { taken: formatNumber(summary.taken), total: formatNumber(summary.total), medications: formatNumber(data.length) })}
              </p>
              <progress
                aria-label="الجرعات المسجلة اليوم"
                value={summary.taken}
                max={summary.total || 1}
              />
            </div>
          </Card>
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
              <h2>لا توجد أدوية مسجلة</h2>
              <p>أضف دواءك ومواعيده وفق الوصفة.</p>
              <Button onClick={() => setForm("new")}>إضافة أول دواء</Button>
            </Card>
          )}
        </>
      )}
      <p className="dashboard-disclosure" data-i18n="declarative">
        <Info size={18} aria-hidden="true" />
        <span>{t(demo ? "بيانات تجريبية تُمسح عند تحديث الصفحة. المواعيد تتكرر يوميًا، ولا توجد إشعارات فعلية. تسجيل التناول يوثّق ما تناولته فقط." : "medications.persistence.notice")}</span>
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
              {t(demo ? "medications.deleteQuestion" : "medications.persistence.deleteQuestion", { name: deleting.name })}
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
                className="btn-danger"
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
