import { Footprints, Droplets, Activity } from "lucide-react";
import { Link } from "react-router";
import type { Habit } from "@/lib/types/habit";
import { progressToday, habitPercent } from "@/lib/utils/habits";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n/context";
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
  const value = progressToday(habit);
  const Icon =
    habit.unit === "steps"
      ? Footprints
      : habit.unit === "cups"
        ? Droplets
        : Activity;
  if (!onProgress)
    return (
      <div className="task-row">
        <span className="icon-tile tone-success">
          <Icon />
        </span>
        <div className="task-copy">
          <h3 data-i18n={(habit.id === "steps" && habit.title === "المشي اليومي") || (habit.id === "water" && habit.title === "شرب الماء") ? "declarative" : undefined}>{habit.id === "steps" && habit.title === "المشي اليومي" ? t("patient.metric.walking") : habit.id === "water" && habit.title === "شرب الماء" ? t("patient.metric.water") : habit.title}</h3>
          <p data-i18n="declarative">
            {t("patient.overview.habitProgress", { value: formatNumber(value), target: formatNumber(habit.target), unit: t(habit.unit === "steps" ? "patient.overview.stepsUnit" : habit.unit === "cups" ? "patient.overview.cupsUnit" : habit.unit === "minutes" ? "patient.overview.minutesUnit" : "patient.overview.timesUnit") })} ·{" "}
            {value >= habit.target ? `✓ ${t("habits.completed")}` : t("patient.overview.inProgress")}
          </p>
        </div>
        <Link className="btn btn-secondary" to="/patient/habits" data-i18n="declarative">
          {t("patient.overview.update")}
        </Link>
      </div>
    );
  return (
    <Card className="habit-detail" dir={direction}>
      <div className="medication-card-heading">
        <span className="icon-tile tone-success">
          <Icon />
        </span>
        <h2 data-i18n="declarative">{habit.id === "steps" && habit.title === "المشي اليومي" ? t("patient.metric.walking") : habit.id === "water" && habit.title === "شرب الماء" ? t("patient.metric.water") : habit.title}</h2>
        <Badge tone={value >= habit.target ? "success" : "info"} data-i18n="declarative">
          {value >= habit.target ? `✓ ${t("habits.completed")}` : t("habits.ui.inProgress")}
        </Badge>
      </div>
      <p className="habit-value" data-i18n="declarative">
        {t("habits.ui.progress", { value: formatNumber(value), target: formatNumber(habit.target), unit: formatHabitUnit(habit.unit, habit.target) })}
      </p>
      <progress
        value={Math.min(value, habit.target)}
        max={habit.target}
        data-i18n="declarative"
        aria-label={t("habits.ui.progressLabel", { name: habit.title })}
      />
      <p className="muted" data-i18n="declarative">
        {t("habits.ui.percent", { value: formatNumber(habitPercent(habit)) })}
        {value > habit.target ? ` · ${t("habits.ui.exceeded")}` : ""}
      </p>
      <Button onClick={() => onProgress(habit)} data-i18n="declarative">{t("habits.ui.record")}</Button>
      <div className="medication-card-actions" data-i18n="declarative">
        <Button variant="secondary" onClick={() => onEdit?.(habit)}>
          {t("habits.ui.edit")}
        </Button>
        <Button
          variant="ghost"
          className="delete-action"
          onClick={() => onDelete?.(habit)}
        >
          {t("common.actions.delete")}
        </Button>
      </div>
    </Card>
  );
}
