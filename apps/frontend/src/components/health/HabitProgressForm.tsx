import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Habit } from "@/lib/types/habit";
import {
  habitProgressSchema,
  progressToday,
} from "@/lib/utils/habits";
import { useSetHabitProgress } from "@/hooks/mutations/useHabitMutations";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n/context";
import { habitValidationKey } from "@/i18n/habitValidation";
const schema = z.object({ value: habitProgressSchema });
export function HabitProgressForm({
  habit,
  onSaved,
}: {
  habit: Habit;
  onSaved: () => void;
}) {
  const { t, formatHabitUnit } = useI18n();
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
      data-i18n="declarative"
      className="stack habit-progress-form"
      noValidate
      onSubmit={handleSubmit(({ value }) =>
        mutation.mutate({ id: habit.id, value }, { onSuccess: onSaved }),
      )}
    >
      <p>{habit.id === "steps" && habit.title === "المشي اليومي" ? t("patient.metric.walking") : habit.id === "water" && habit.title === "شرب الماء" ? t("patient.metric.water") : habit.title}</p>
      <Input
        label={t("habits.ui.totalToday", { unit: formatHabitUnit(habit.unit) })}
        type="number"
        inputMode="numeric"
        {...register("value", { valueAsNumber: true })}
        error={errors.value?.message ? t(habitValidationKey(errors.value.message)) : undefined}
      />
      <p className="muted medication-form-note">
        {t("habits.ui.progressHint")}
      </p>
      <Button type="submit" disabled={mutation.isPending}>
        {t("habits.ui.saveProgress")}
      </Button>
    </form>
  );
}
