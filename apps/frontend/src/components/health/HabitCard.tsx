import { Footprints, Droplets, Activity } from "lucide-react";
import { Link } from "react-router";
import type { Habit } from "@/lib/types/habit";
import { habitUnits, progressToday, habitPercent } from "@/lib/utils/habits";
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
  const { t, formatNumber } = useI18n();
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
    <Card className="habit-detail">
      <div className="medication-card-heading">
        <span className="icon-tile tone-success">
          <Icon />
        </span>
        <h2>{habit.title}</h2>
        <Badge tone={value >= habit.target ? "success" : "info"}>
          {value >= habit.target ? "✓ مكتملة" : "قيد الإنجاز"}
        </Badge>
      </div>
      <p className="habit-value">
        <strong>{formatNumber(value)}</strong> من{" "}
        {formatNumber(habit.target)} {habitUnits[habit.unit]}
      </p>
      <progress
        value={Math.min(value, habit.target)}
        max={habit.target}
        aria-label={`تقدم ${habit.title}`}
      />
      <p className="muted">
        {habitPercent(habit)}% من الهدف
        {value > habit.target ? " · تجاوزت الهدف المسجل" : ""}
      </p>
      <Button onClick={() => onProgress(habit)}>تسجيل تقدم اليوم</Button>
      <div className="medication-card-actions">
        <Button variant="secondary" onClick={() => onEdit?.(habit)}>
          تعديل العادة
        </Button>
        <Button
          variant="ghost"
          className="delete-action"
          onClick={() => onDelete?.(habit)}
        >
          حذف
        </Button>
      </div>
    </Card>
  );
}
