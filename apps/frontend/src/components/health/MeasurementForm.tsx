import { useId, useRef, useState } from "react";
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
  onCancel,
  initial,
}: {
  onSaved: (measurement: Measurement) => void;
  onCancel?: () => void;
  initial?: Measurement;
}) {
  const formId = useId();
  const kindId = onCancel ? formId : "reading-kind";
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
  const submitLock = useRef(false);
  const isPending = formState.isSubmitting || add.isPending || update.isPending;
  return (
    <form
      data-i18n="declarative"
      className="stack"
      onSubmit={handleSubmit(async (values) => {
        if (submitLock.current) return;
        submitLock.current = true;
        try {
          const measurement = initial
            ? await update.mutateAsync({ id: initial.id, input: values })
            : await add.mutateAsync(values);
          onSaved(measurement);
        } catch {
          // Mutation hooks own error feedback; keep the form open for retry.
        } finally {
          submitLock.current = false;
        }
      })}
      noValidate
    >
      <p className="muted">{t("measurements.persistence.formNotice")}</p>
      <div className="field">
        <label htmlFor={kindId}>{t("measurements.ui.readingKind")}</label>
        <select
          id={kindId}
          name="kind"
          disabled={isPending}
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
            autoFocus={!!onCancel}
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
      <div className="measurement-form-actions">
        <Button type="submit" disabled={isPending}>
          {t(isPending ? "measurements.ui.saving" : initial ? "measurements.ui.saveChanges" : "measurements.ui.saveReading")}
        </Button>
        {onCancel && <Button type="button" variant="secondary" disabled={isPending} onClick={onCancel}>{t("common.actions.cancel")}</Button>}
      </div>
    </form>
  );
}
