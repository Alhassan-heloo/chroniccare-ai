import { useState } from "react";
import { Plus } from "lucide-react";
import type { Habit } from "@/lib/types/habit";
import { useHabits } from "@/hooks/queries/useHabits";
import { useDeleteHabit } from "@/hooks/mutations/useHabitMutations";
import { progressToday } from "@/lib/utils/habits";
import { HabitCard } from "@/components/health/HabitCard";
import { HabitForm } from "@/components/health/HabitForm";
import { HabitProgressForm } from "@/components/health/HabitProgressForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { useI18n } from "@/i18n/context";
export default function HabitsPage() {
  const { t, formatNumber, direction, locale } = useI18n();
  const { data = [], isPending, isError, refetch } = useHabits();
  const [form, setForm] = useState<Habit | "new" | null>(null);
  const [progress, setProgress] = useState<Habit | null>(null);
  const [deleting, setDeleting] = useState<Habit | null>(null);
  const deletion = useDeleteHabit();
  const completed = data.filter(
    (item) => progressToday(item) >= item.target,
  ).length;
  return (
    <div className="stack habits-page" dir={direction}>
      <div className="section-heading measurements-heading" data-i18n="declarative">
        <div>
          <span className="eyebrow">{t("habits.ui.eyebrow")}</span>
          <h1>{t("habits.title")}</h1>
          <p>{t("habits.ui.description")}</p>
        </div>
        <Button onClick={() => setForm("new")}>
          <Plus size={20} />
          {t("habits.add")}
        </Button>
      </div>
      <p className="measurements-notice" data-i18n="declarative">
        {t("habits.ui.notice")}
      </p>
      {isPending ? (
        <Card className="empty-state" role="status" data-i18n="declarative">
          {t("habits.ui.loading")}
        </Card>
      ) : isError ? (
        <Card className="empty-state" role="alert" data-i18n="declarative">
          <p>{t("habits.ui.error")}</p>
          <Button onClick={() => void refetch()}>{t("common.actions.retry")}</Button>
        </Card>
      ) : (
        <>
          <div className="feature-workbench"><Card className="medication-summary habit-summary" data-i18n="declarative">
            <h2>{t("habits.ui.achievement")}</h2>
            <p aria-live="polite">
              {t(new Intl.PluralRules(locale).select(data.length) === "one" ? "habits.completedSingle" : "habits.ui.completedSummary", { completed: formatNumber(completed), total: formatNumber(data.length) })}
            </p>
            <progress
              value={completed}
              max={data.length || 1}
              aria-label={t("habits.ui.completedLabel")}
            />
          </Card>
          {data.length ? (
            <div className="medication-grid">
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
            <Card className="empty-state measurement-empty" data-i18n="declarative">
              <h2>{t("habits.empty")}</h2>
              <p>{t("habits.ui.emptyDescription")}</p>
              <Button onClick={() => setForm("new")}>{t("habits.add")}</Button>
            </Card>
          )}</div>
        </>
      )}
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
