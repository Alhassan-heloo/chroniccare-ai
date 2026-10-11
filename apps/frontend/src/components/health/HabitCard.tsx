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
  const { formatNumber } = useI18n();
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
          <h3>{habit.title}</h3>
          <p>
            {value} / {habit.target} {habitUnits[habit.unit]} ·{" "}
            {value >= habit.target ? "✓ مكتملة" : "قيد الإنجاز"}
          </p>
        </div>
        <Link className="btn btn-secondary" to="/patient/habits">
          تحديث
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
