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
import { PatientPageHeader } from "@/components/layout/PatientPageHeader";
import { useI18n } from "@/i18n/context";
import "@/styles/evolution/records.css";
import type { HabitTemplate } from "@/lib/habitTemplates";
export default function HabitsPage() {
  const { t, formatNumber, direction, locale, language } = useI18n();
  const { data = [], isPending, isError, refetch } = useHabits();
  const [form, setForm] = useState<Habit | "new" | null>(null);
  const [progress, setProgress] = useState<Habit | null>(null);
  const [deleting, setDeleting] = useState<Habit | null>(null);
  const [template, setTemplate] = useState<HabitTemplate | null>(null);
  const [view, setView] = useState<"all" | "ongoing" | "completed">("all");
  const deletion = useDeleteHabit();
  const completed = data.filter(
    (item) => progressToday(item) >= item.target,
  ).length;
  const visible = data.filter(item => view === "all" || (view === "completed" ? progressToday(item) >= item.target : progressToday(item) < item.target));
  return (
    <div className="habits-page records-page grid gap-6" dir={direction}>
      <PatientPageHeader
        className="habits-heading"
        title={t("habits.title")}
        description={t("habits.ui.description")}
        action={<Button onClick={() => setForm("new")}><Plus size={18} aria-hidden="true" />{t("habits.add")}</Button>}
      />
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
            <section aria-labelledby="habits-today-heading">
              <div className="records-habit-toolbar" data-i18n="declarative">
                <div className="records-habit-overview">
                  <h2 id="habits-today-heading">{t("habits.today.title")}</h2>
                  <p role="status">
                    {t(new Intl.PluralRules(locale).select(data.length) === "one" ? "habits.completedSingle" : "habits.ui.completedSummary", { completed: formatNumber(completed), total: formatNumber(data.length) })}
                  </p>
                  <progress className="sr-only" value={completed} max={data.length} aria-label={t("habits.ui.completedLabel")} />
                </div>
                <div className="records-chart-tabs" role="group" aria-label={language === "ar" ? "عرض العادات" : "Filter habits"}>
                  {(["all", "ongoing", "completed"] as const).map(item => <Button key={item} variant="secondary" aria-pressed={view === item} onClick={() => setView(item)}>{item === "all" ? (language === "ar" ? "الكل" : "All") : t(item === "completed" ? "habits.completed" : "habits.ui.inProgress")}</Button>)}
                </div>
              </div>
            <div className="habits-grid">
              {visible.map((item) => (
                <HabitCard
                  key={item.id}
                  habit={item}
                  onProgress={setProgress}
                  onEdit={setForm}
                  onDelete={setDeleting}
                />
              ))}
            </div>
              {!visible.length && <p className="empty-state" role="status" data-i18n="declarative">{language === "ar" ? "لا توجد عادات في هذا العرض." : "No habits in this view."}</p>}
            </section>
          ) : (
            <Card className="empty-state measurement-empty glass" data-i18n="declarative">
              <Footprints size={36} aria-hidden="true" />
              <h2>{t("habits.empty")}</h2>
              <p>{t("habits.ui.emptyDescription")}</p>
              <Button onClick={() => setForm("new")}>{t("habits.add")}</Button>
            </Card>
          )}
          <details className="records-template-disclosure">
            <summary data-i18n="declarative">{t("habits.templates.title")}<small>{language === "ar" ? "اختر عادة، ثم اضبط هدفك" : "Choose a habit and set your own goal"}</small></summary>
            <HabitTemplateLibrary habits={data} onCustomize={setTemplate} onEdit={setForm} />
          </details>
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
                variant="danger"
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
