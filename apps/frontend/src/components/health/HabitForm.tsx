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
export function HabitForm({
  initial,
  onSaved,
}: {
  initial?: Habit;
  onSaved: () => void;
}) {
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
      className="stack"
      noValidate
      onSubmit={handleSubmit((input) =>
        initial
          ? update.mutate({ id: initial.id, input }, { onSuccess: onSaved })
          : add.mutate(input, { onSuccess: onSaved }),
      )}
    >
      <Input
        label="اسم العادة"
        {...register("title")}
        error={errors.title?.message}
      />
      <div className="field">
        <label htmlFor="habit-unit">وحدة القياس</label>
        <select id="habit-unit" {...register("unit")}>
          {Object.entries(habitUnits).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <Input
        label="الهدف اليومي"
        type="number"
        inputMode="numeric"
        {...register("target", { valueAsNumber: true })}
        error={errors.target?.message}
      />
      <p className="muted medication-form-note">
        حدد الهدف المناسب لك. الأهداف الافتراضية أمثلة وليست توصيات صحية.
        {initial
          ? " تغيير الوحدة يصفر تقدم اليوم؛ تغيير الهدف يبقي المقدار المسجل."
          : ""}
      </p>
      <Button type="submit" disabled={add.isPending || update.isPending}>
        حفظ العادة
      </Button>
    </form>
  );
}
