import { useState } from "react";
import { Plus, Footprints, Info } from "lucide-react";
import type { Habit } from "@/lib/types/habit";
import { useHabits } from "@/hooks/queries/useHabits";
import { useDeleteHabit } from "@/hooks/mutations/useHabitMutations";
import { progressToday } from "@/lib/utils/habits";
import { HabitCard } from "@/components/health/HabitCard";
import { HabitForm } from "@/components/health/HabitForm";
import { HabitProgressForm } from "@/components/health/HabitProgressForm";
import { HabitTemplateLibrary } from "@/components/health/HabitTemplateLibrary";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { useI18n } from "@/i18n/context";
import { SignatureArtwork } from "@/components/public/living/ui";
import type { HabitTemplate } from "@/lib/habitTemplates";
export default function HabitsPage() {
  const { t, formatNumber, direction, locale } = useI18n();
  const { data = [], isPending, isError, refetch } = useHabits();
  const [form, setForm] = useState<Habit | "new" | null>(null);
  const [progress, setProgress] = useState<Habit | null>(null);
  const [deleting, setDeleting] = useState<Habit | null>(null);
  const [template, setTemplate] = useState<HabitTemplate | null>(null);
  const deletion = useDeleteHabit();
  const completed = data.filter(
    (item) => progressToday(item) >= item.target,
  ).length;
  return (
    <div className="stack habits-page" dir={direction}>
      <div className="habits-heading dashboard-welcome" data-i18n="declarative">
        <SignatureArtwork />
        <div>
          <span className="eyebrow">{t("habits.ui.eyebrow")}</span>
          <h1>{t("habits.title")}</h1>
          <p>{t("habits.ui.description")}</p>
        </div>
        {!isPending && !isError && <Card className="habit-summary glass">
            <div className="dashboard-panel-heading"><span className="dashboard-feature-icon" aria-hidden="true"><Footprints size={20} /></span><h2>{t("habits.ui.achievement")}</h2></div>
            <p aria-live="polite">
              {t(new Intl.PluralRules(locale).select(data.length) === "one" ? "habits.completedSingle" : "habits.ui.completedSummary", { completed: formatNumber(completed), total: formatNumber(data.length) })}
            </p>
            <progress
              value={completed}
              max={data.length || 1}
              aria-label={t("habits.ui.completedLabel")}
            />
          </Card>}
      </div>
      <div className="habits-actions dashboard-canvas-actions" data-i18n="declarative">
        <Button onClick={() => setForm("new")}><Plus size={19} aria-hidden="true" />{t("habits.add")}</Button>
      </div>
      {isPending ? (
        <Card className="empty-state glass" role="status" data-i18n="declarative">
          {t("habits.ui.loading")}
        </Card>
      ) : isError ? (
        <Card className="empty-state glass" role="alert" data-i18n="declarative">
          <p>{t("habits.ui.error")}</p>
          <Button onClick={() => void refetch()}>{t("common.actions.retry")}</Button>
        </Card>
      ) : (
        <>
          {data.length ? (
            <div className="habits-grid">
              {data.map((item) => (
                <HabitCard
                  key={item.id}
                  habit={item}
                  onProgress={setProgress}
                  onEdit={setForm}
                  onDelete={setDeleting}
                />
              ))}
            </div>
          ) : (
            <Card className="empty-state measurement-empty glass" data-i18n="declarative">
              <Footprints size={36} aria-hidden="true" />
              <h2>{t("habits.empty")}</h2>
              <p>{t("habits.ui.emptyDescription")}</p>
              <Button onClick={() => setForm("new")}>{t("habits.add")}</Button>
            </Card>
          )}
          <HabitTemplateLibrary habits={data} onCustomize={setTemplate} onEdit={setForm} />
        </>
      )}
      <p className="dashboard-disclosure" data-i18n="declarative"><Info size={18} aria-hidden="true" /><span>{t("habits.ui.notice")}</span></p>
      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={t(form === "new" ? "habits.add" : "habits.ui.edit")}
        declarativeTitle
      >
        {form && (
          <HabitForm
            key={form === "new" ? "new" : form.id}
            initial={form === "new" ? undefined : form}
            onSaved={() => setForm(null)}
          />
        )}
      </Modal>
      <Modal
        open={!!template}
        onClose={() => setTemplate(null)}
        title={t("habits.templates.customizeTitle")}
        declarativeTitle
      >
        {template && (
          <HabitForm
            key={template.id}
            draft={{
              title: t(template.titleKey),
              unit: template.unit,
              target: template.exampleTarget,
            }}
            templateKey={template.id}
            onSaved={() => setTemplate(null)}
          />
        )}
      </Modal>
      <Modal
        open={!!progress}
        onClose={() => setProgress(null)}
        title={t("habits.ui.record")}
        declarativeTitle
      >
        {progress && (
          <HabitProgressForm
            key={progress.id}
            habit={progress}
            onSaved={() => setProgress(null)}
          />
        )}
      </Modal>
      <Modal
        open={!!deleting}
        onClose={() => {
          if (!deletion.isPending) setDeleting(null);
        }}
        title={t("habits.ui.deleteTitle")}
        declarativeTitle
      >
        {deleting && (
          <div className="stack">
            <p data-i18n="declarative">
              {t("habits.ui.deleteQuestion", { name: deleting.title })}
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
                {t("habits.ui.confirmDelete")}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
