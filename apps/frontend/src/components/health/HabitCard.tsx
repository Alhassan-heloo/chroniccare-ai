import { Footprints, Droplets, Activity, Pencil, Trash2, SlidersHorizontal } from "lucide-react";
import { Link } from "react-router";
import type { CSSProperties } from "react";
import type { Habit } from "@/lib/types/habit";
import { progressToday, habitPercent, habitDay } from "@/lib/utils/habits";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n/context";
import { useHabitQuickProgress } from "@/hooks/mutations/useHabitQuickProgress";

const quickStep = { cups: 1, times: 1, minutes: 5, steps: 500 } as const;
export function HabitCard({
  habit,
  onProgress,
  onEdit,
  onDelete,
}: {
  habit: Habit;
  onProgress?: (habit: Habit) => void;
  onEdit?: (habit: Habit) => void;
  onDelete?: (habit: Habit) => void;
}) {
  const { t, formatNumber, formatHabitUnit, direction, language } = useI18n();
  const quick = useHabitQuickProgress(habit);
  const value = onProgress ? quick.value : progressToday(habit);
  const displayedHabit = { ...habit, progress: value, recordedOn: habitDay() };
  const Icon =
    habit.unit === "steps"
      ? Footprints
      : habit.unit === "cups"
        ? Droplets
        : Activity;
  const displayTitle = habit.id === "steps" && habit.title === "المشي اليومي" ? t("patient.metric.walking") : habit.id === "water" && habit.title === "شرب الماء" ? t("patient.metric.water") : habit.title;
  const percent = habitPercent(displayedHabit);
  const segmentCount = (habit.unit === "cups" || habit.unit === "times") && habit.target <= 12 ? Math.max(1, habit.target) : 12;
  const status = value >= habit.target ? "habits.today.done" : value > 0 ? "habits.today.partial" : "habits.today.unrecorded";
  if (!onProgress)
    return (
      <div className="task-row">
        <span className="icon-tile tone-success">
          <Icon />
        </span>
        <div className="task-copy">
          <h3 data-i18n={(habit.id === "steps" && habit.title === "المشي اليومي") || (habit.id === "water" && habit.title === "شرب الماء") ? "declarative" : undefined}>{habit.id === "steps" && habit.title === "المشي اليومي" ? t("patient.metric.walking") : habit.id === "water" && habit.title === "شرب الماء" ? t("patient.metric.water") : habit.title}</h3>
          <p data-i18n="declarative">
            {t("habits.ui.progress", { value: formatNumber(value), target: formatNumber(habit.target), unit: formatHabitUnit(habit.unit, habit.target) })} ·{" "}
            {value >= habit.target ? `✓ ${t("habits.completed")}` : t("patient.overview.inProgress")}
          </p>
        </div>
        <Link className="btn btn-secondary" to="/patient/habits" data-i18n="declarative">
          {t("patient.overview.update")}
        </Link>
      </div>
    );
  return (
    <Card className="habit-detail evolution-habit-row" dir={direction} role="group" aria-label={displayTitle} data-i18n="declarative">
      <div className="habit-row-main">
      <div className="habit-card-heading">
        <span className="dashboard-feature-icon" aria-hidden="true">
          <Icon size={20} />
        </span>
        <h3><bdi>{displayTitle}</bdi></h3>
      </div>
      <p className="habit-recorded-status" role="status">
        <Badge tone={value >= habit.target ? "success" : "info"}>
          {t(quick.pending ? "habits.quick.saving" : status)}
        </Badge>
      </p>
      <p className="habit-value" data-i18n="declarative">
        {t("habits.ui.progress", { value: formatNumber(value), target: formatNumber(habit.target), unit: formatHabitUnit(habit.unit, habit.target) })}
      </p>
      <progress
        className="sr-only"
        value={Math.min(value, habit.target)}
        max={habit.target}
        data-i18n="declarative"
        aria-label={t("habits.ui.progressLabel", { name: displayTitle })}
      />
      <div className="habit-segments" aria-hidden="true" style={{ "--segments": segmentCount } as CSSProperties}>
        {Array.from({ length: segmentCount }, (_, index) => <span key={index}><i style={{ width: `${Math.max(0, Math.min(100, value / habit.target * segmentCount * 100 - index * 100))}%` }} /></span>)}
      </div>
      <p className="habit-progress-meta muted" data-i18n="declarative">
        {t("habits.ui.percent", { value: formatNumber(percent) })}
        {value > habit.target ? ` · ${t("habits.ui.exceeded")}` : ""}
      </p>
      </div>
      <div className="habit-row-controls">
      {habit.unit === "times" && habit.target === 1 ? (
        <Button
          className="button habit-quick-complete"
          variant={value >= 1 ? "secondary" : "primary"}
          onClick={() => quick.setProgress(value >= 1 ? 0 : 1)}
          aria-label={t(value >= 1 ? "habits.quick.undoCompletion" : "habits.today.record")}
        >
          {t(value >= 1 ? "habits.quick.undoCompletion" : "habits.today.record")}
        </Button>
      ) : (
        <div className="habit-quick-actions" role="group" aria-label={t("habits.quick.group", { name: displayTitle })}>
          <Button
            className="button habit-quick-decrement"
            variant="secondary"
            disabled={value <= 0}
            onClick={() => quick.adjust(-quickStep[habit.unit])}
            aria-label={t("habits.quick.subtract", { amount: formatNumber(Math.min(value, quickStep[habit.unit])), unit: formatHabitUnit(habit.unit, Math.min(value, quickStep[habit.unit])) })}
          >
            −{formatNumber(Math.min(value, quickStep[habit.unit]))}
          </Button>
          <Button
            className="button habit-quick-add"
            onClick={() => quick.adjust(quickStep[habit.unit])}
            aria-label={t("habits.quick.add", { amount: formatNumber(quickStep[habit.unit]), unit: formatHabitUnit(habit.unit, quickStep[habit.unit]) })}
          >
            {t("habits.today.recordAmount", { amount: formatNumber(quickStep[habit.unit]), unit: formatHabitUnit(habit.unit, quickStep[habit.unit]) })}
          </Button>
        </div>
      )}
      </div>
      <details className="habit-manage">
      <summary aria-label={language === "ar" ? "إدارة العادة" : "Manage habit"}><SlidersHorizontal size={17} aria-hidden="true" /><span>{language === "ar" ? "إدارة العادة" : "Manage habit"}</span></summary>
      <div className="habit-manage-actions">
      <Button className="button habit-record" variant="secondary" disabled={quick.pending} onClick={() => onProgress(displayedHabit)} data-i18n="declarative"><SlidersHorizontal size={18} aria-hidden="true" />{t("habits.quick.precise")}</Button>
      <div className="medication-card-actions" data-i18n="declarative">
        <Button className="button" variant="secondary" disabled={quick.pending} onClick={() => onEdit?.(habit)}>
          <Pencil size={17} aria-hidden="true" />
          {t("habits.ui.edit")}
        </Button>
        <Button
          variant="ghost"
          className="delete-action"
          disabled={quick.pending}
          onClick={() => onDelete?.(habit)}
        >
          <Trash2 size={17} aria-hidden="true" />
          {t("common.actions.delete")}
        </Button>
      </div>
      </div>
      </details>
    </Card>
  );
}
