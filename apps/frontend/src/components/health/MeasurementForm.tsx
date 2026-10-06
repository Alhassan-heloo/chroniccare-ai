import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type {
  MeasurementInput,
  MeasurementKind,
  Measurement,
} from "@/lib/types/measurement";
import { measurementSchema } from "@/lib/utils/measurementSchema";
import {
  useAddMeasurement,
  useUpdateMeasurement,
} from "@/hooks/mutations/useMeasurementMutations";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
export function MeasurementForm({
  onSaved,
  initial,
}: {
  onSaved: () => void;
  initial?: Measurement;
}) {
  const [kind, setKind] = useState<MeasurementKind>(
    initial?.kind ?? "bloodPressure",
  );
  const { register, handleSubmit, reset, getFieldState, formState } =
    useForm<MeasurementInput>({
      resolver: zodResolver(measurementSchema),
      defaultValues: initial ?? { kind: "bloodPressure" },
    });
  const add = useAddMeasurement();
  const update = useUpdateMeasurement();
  const isPending = add.isPending || update.isPending;
  return (
    <form
      className="stack"
      onSubmit={handleSubmit((values) => {
        if (initial)
          update.mutate(
            { id: initial.id, input: values },
            { onSuccess: onSaved },
          );
        else add.mutate(values, { onSuccess: onSaved });
      })}
      noValidate
    >
      <p className="muted">قراءة تجريبية، تحفظ حتى إعادة تحميل الصفحة.</p>
      <div className="field">
        <label htmlFor="reading-kind">نوع القراءة</label>
        <select
          id="reading-kind"
          value={kind}
          onChange={(event) => {
            const next = event.target.value as MeasurementKind;
            setKind(next);
            reset(
              next === "bloodPressure"
                ? { kind: "bloodPressure" }
                : { kind: "glucose" },
            );
          }}
        >
          <option value="bloodPressure">ضغط الدم — mmHg</option>
          <option value="glucose">سكر الدم — mg/dL</option>
        </select>
      </div>
      {kind === "bloodPressure" ? (
        <div className="form-grid">
          <Input
            label="الضغط الانقباضي"
            type="number"
            inputMode="numeric"
            {...register("systolic", { valueAsNumber: true })}
            error={getFieldState("systolic", formState).error?.message}
          />
          <Input
            label="الضغط الانبساطي"
            type="number"
            inputMode="numeric"
            {...register("diastolic", { valueAsNumber: true })}
            error={getFieldState("diastolic", formState).error?.message}
          />
        </div>
      ) : (
        <Input
          label="سكر الدم"
          type="number"
          step="any"
          inputMode="decimal"
          {...register("value", { valueAsNumber: true })}
          error={getFieldState("value", formState).error?.message}
        />
      )}
      <Button type="submit" disabled={isPending}>
        {isPending ? "جارٍ الحفظ…" : initial ? "حفظ التعديلات" : "حفظ القراءة"}
      </Button>
    </form>
  );
}
