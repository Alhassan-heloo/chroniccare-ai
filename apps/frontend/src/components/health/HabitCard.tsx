import { Footprints, Droplets, Check } from "lucide-react";
import type { Habit } from "@/lib/types/habit";
import { Button } from "@/components/ui/Button";
import { useToggleHabit } from "@/hooks/mutations/usePatientMutations";
export function HabitCard({ habit }: { habit: Habit }) {
  const mutation = useToggleHabit();
  const Icon = habit.kind === "walk" ? Footprints : Droplets;
  return (
    <div className="task-row">
      <span className="icon-tile tone-warning">
        <Icon />
      </span>
      <div className="task-copy">
        <h3>{habit.title}</h3>
        <p>{habit.description}</p>
      </div>
      <Button
        variant="secondary"
        aria-pressed={habit.completed}
        aria-label={`${habit.completed ? "إلغاء إتمام" : "إتمام"} ${habit.title}`}
        disabled={mutation.isPending}
        onClick={() => mutation.mutate(habit.id)}
      >
        {habit.completed ? (
          <>
            <Check size={17} />
            تم
          </>
        ) : (
          "إتمام"
        )}
      </Button>
    </div>
  );
}
