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
import { useI18n } from "@/i18n/context";
import { isTranslationKey } from "@/i18n/catalog";
export function MeasurementForm({
  onSaved,
  initial,
}: {
  onSaved: () => void;
  initial?: Measurement;
}) {
  const { t, formatUnit } = useI18n();
  const errorMessage = (message?: string) => message ? isTranslationKey(message) ? t(message) : t("measurements.ui.checkReading") : undefined;
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
      data-i18n="declarative"
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
      <p className="muted">{t("measurements.ui.formNotice")}</p>
      <div className="field">
        <label htmlFor="reading-kind">{t("measurements.ui.readingKind")}</label>
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
          <option value="bloodPressure">{t("measurements.bloodPressure")} — {formatUnit("mmHg")}</option>
          <option value="glucose">{t("measurements.bloodGlucose")} — {formatUnit("mg/dL")}</option>
        </select>
      </div>
      {kind === "bloodPressure" ? (
        <div className="form-grid">
          <Input
            label={t("measurements.ui.systolic")}
            type="number"
            inputMode="numeric"
            {...register("systolic", { valueAsNumber: true })}
            error={errorMessage(getFieldState("systolic", formState).error?.message)}
          />
          <Input
            label={t("measurements.ui.diastolic")}
            type="number"
            inputMode="numeric"
            {...register("diastolic", { valueAsNumber: true })}
            error={errorMessage(getFieldState("diastolic", formState).error?.message)}
          />
        </div>
      ) : (
        <Input
          label={t("measurements.bloodGlucose")}
          type="number"
          step="any"
          inputMode="decimal"
          {...register("value", { valueAsNumber: true })}
          error={errorMessage(getFieldState("value", formState).error?.message)}
        />
      )}
      <Button type="submit" disabled={isPending}>
        {t(isPending ? "measurements.ui.saving" : initial ? "measurements.ui.saveChanges" : "measurements.ui.saveReading")}
      </Button>
    </form>
  );
}
