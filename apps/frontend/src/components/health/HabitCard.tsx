import { Footprints, Droplets, Activity, Pencil, Trash2, SlidersHorizontal } from "lucide-react";
import { Link } from "react-router";
import type { Habit } from "@/lib/types/habit";
import { progressToday, habitPercent, habitDay } from "@/lib/utils/habits";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n/context";
import { LivingPulse, ValueArrival } from "@/components/public/living/ui";
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
  const { t, formatNumber, formatHabitUnit, direction } = useI18n();
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
    <Card className="habit-detail glass" dir={direction} role="group" aria-label={displayTitle} data-i18n="declarative">
      <LivingPulse cue={`${habit.id}:${value}:${habit.target}`} />
      <div className="habit-card-heading dashboard-panel-heading">
        <span className="dashboard-feature-icon" aria-hidden="true">
          <Icon size={20} />
        </span>
        <h2 data-i18n="declarative">{displayTitle}</h2>
        <Badge tone={value >= habit.target ? "success" : "info"} data-i18n="declarative">
          {quick.pending
            ? t("habits.quick.saving")
            : value >= habit.target
              ? `✓ ${t("habits.completed")}`
              : t("habits.ui.inProgress")}
        </Badge>
      </div>
      <p className="habit-value" data-i18n="declarative">
        <ValueArrival value={t("habits.ui.progress", { value: formatNumber(value), target: formatNumber(habit.target), unit: formatHabitUnit(habit.unit, habit.target) })} />
      </p>
      <progress
        value={Math.min(value, habit.target)}
        max={habit.target}
        data-i18n="declarative"
        aria-label={t("habits.ui.progressLabel", { name: displayTitle })}
      />
      <p className="habit-progress-meta muted" data-i18n="declarative">
        {t("habits.ui.percent", { value: formatNumber(habitPercent(displayedHabit)) })}
        {value > habit.target ? ` · ${t("habits.ui.exceeded")}` : ""}
      </p>
      {habit.unit === "times" && habit.target === 1 ? (
        <Button
          className="button habit-quick-complete"
          variant={value >= 1 ? "secondary" : "primary"}
          onClick={() => quick.setProgress(value >= 1 ? 0 : 1)}
          aria-label={t(value >= 1 ? "habits.quick.undoCompletion" : "habits.quick.complete")}
        >
          {t(value >= 1 ? "habits.quick.undoCompletion" : "habits.quick.complete")}
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
            +{formatNumber(quickStep[habit.unit])} {formatHabitUnit(habit.unit, quickStep[habit.unit])}
          </Button>
        </div>
      )}
      <p className="habit-quick-status muted" role="status" aria-live="polite">
        {quick.pending ? t("habits.quick.saving") : t("habits.quick.ready")}
      </p>
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
    </Card>
  );
}
