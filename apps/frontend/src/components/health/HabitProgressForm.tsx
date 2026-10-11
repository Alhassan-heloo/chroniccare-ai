import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Habit } from "@/lib/types/habit";
import {
  habitProgressSchema,
  habitUnits,
  progressToday,
} from "@/lib/utils/habits";
import { useSetHabitProgress } from "@/hooks/mutations/useHabitMutations";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
const schema = z.object({ value: habitProgressSchema });
export function HabitProgressForm({
  habit,
  onSaved,
}: {
  habit: Habit;
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ value: number }>({
    resolver: zodResolver(schema),
    defaultValues: { value: progressToday(habit) },
  });
  const mutation = useSetHabitProgress();
  return (
    <form
      className="stack"
      noValidate
      onSubmit={handleSubmit(({ value }) =>
        mutation.mutate({ id: habit.id, value }, { onSuccess: onSaved }),
      )}
    >
      <p>{habit.title}</p>
      <Input
        label={`إجمالي ما أنجزته اليوم (${habitUnits[habit.unit]})`}
        type="number"
        inputMode="numeric"
        {...register("value", { valueAsNumber: true })}
        error={errors.value?.message}
      />
      <p className="muted medication-form-note">
        هذه القيمة تستبدل إجمالي اليوم، ولا تضاف إليه. يمكنك إدخال صفر لإلغاء
        تقدم اليوم.
      </p>
      <Button type="submit" disabled={mutation.isPending}>
        حفظ التقدم
      </Button>
    </form>
  );
}
