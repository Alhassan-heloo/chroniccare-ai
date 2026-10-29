import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Habit, HabitInput } from "@/lib/types/habit";
import { habitSchema, habitUnits } from "@/lib/utils/habits";
import {
  useAddHabit,
  useUpdateHabit,
} from "@/hooks/mutations/useHabitMutations";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n/context";
import { habitValidationKey } from "@/i18n/habitValidation";
import type { HabitUnit } from "@/i18n/formatters";
export function HabitForm({
  initial,
  onSaved,
}: {
  initial?: Habit;
  onSaved: () => void;
}) {
  const { t, formatHabitUnit } = useI18n();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<HabitInput>({
    resolver: zodResolver(habitSchema),
    defaultValues: initial ?? { title: "", unit: "minutes", target: 20 },
  });
  const add = useAddHabit();
  const update = useUpdateHabit();
  return (
    <form
      data-i18n="declarative"
      className="stack habit-form"
      noValidate
      onSubmit={handleSubmit((input) =>
        initial
          ? update.mutate({ id: initial.id, input }, { onSuccess: onSaved })
          : add.mutate(input, { onSuccess: onSaved }),
      )}
    >
      <Input
        label={t("habits.ui.name")}
        {...register("title")}
        error={errors.title?.message ? t(habitValidationKey(errors.title.message)) : undefined}
      />
      <div className="field">
        <label htmlFor="habit-unit">{t("habits.ui.unit")}</label>
        <select id="habit-unit" {...register("unit")}>
          {Object.keys(habitUnits).map((key) => (
            <option key={key} value={key}>
              {formatHabitUnit(key as HabitUnit)}
            </option>
          ))}
        </select>
      </div>
      <Input
        label={t("habits.ui.target")}
        type="number"
        inputMode="numeric"
        {...register("target", { valueAsNumber: true })}
        error={errors.target?.message ? t(habitValidationKey(errors.target.message)) : undefined}
      />
      <p className="muted medication-form-note">
        {t("habits.ui.advice")}
        {initial
          ? ` ${t("habits.ui.changeHint")}`
          : ""}
      </p>
      <Button type="submit" disabled={add.isPending || update.isPending}>
        {t("habits.ui.save")}
      </Button>
    </form>
  );
}
