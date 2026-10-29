import { Footprints, Droplets, Activity, Pencil, Trash2, Plus } from "lucide-react";
import { Link } from "react-router";
import type { Habit } from "@/lib/types/habit";
import { progressToday, habitPercent } from "@/lib/utils/habits";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n/context";
import { LivingPulse, ValueArrival } from "@/components/public/living/ui";
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
          {value >= habit.target ? `✓ ${t("habits.completed")}` : t("habits.ui.inProgress")}
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
        {t("habits.ui.percent", { value: formatNumber(habitPercent(habit)) })}
        {value > habit.target ? ` · ${t("habits.ui.exceeded")}` : ""}
      </p>
      <Button className="button habit-record" onClick={() => onProgress(habit)} data-i18n="declarative"><Plus size={18} aria-hidden="true" />{t("habits.ui.record")}</Button>
      <div className="medication-card-actions" data-i18n="declarative">
        <Button className="button" variant="secondary" onClick={() => onEdit?.(habit)}>
          <Pencil size={17} aria-hidden="true" />
          {t("habits.ui.edit")}
        </Button>
        <Button
          variant="ghost"
          className="delete-action"
          onClick={() => onDelete?.(habit)}
        >
          <Trash2 size={17} aria-hidden="true" />
          {t("common.actions.delete")}
        </Button>
      </div>
    </Card>
  );
}
