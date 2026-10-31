import { useRef } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, X } from "lucide-react";
import type { Medication, MedicationInput } from "@/lib/types/medication";
import { medicationSchema } from "@/lib/utils/medicationSchema";
import {
  useAddMedication,
  useUpdateMedication,
} from "@/hooks/mutations/useMedicationMutations";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n/context";
export function MedicationForm({
  initial,
  onSaved,
}: {
  initial?: Medication;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MedicationInput>({
    resolver: zodResolver(medicationSchema),
    defaultValues: initial ?? {
      name: "",
      dosage: "",
      notes: "",
      doses: [{ time: "" }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "doses" });
  const add = useAddMedication();
  const update = useUpdateMedication();
  const submitLock = useRef(false);
  const pending = isSubmitting || add.isPending || update.isPending;
  return (
    <form
      className="stack medication-form"
      noValidate
      onSubmit={handleSubmit(async (input) => {
        if (submitLock.current) return;
        submitLock.current = true;
        try {
          if (initial) await update.mutateAsync({ id: initial.id, input });
          else await add.mutateAsync(input);
          onSaved();
        } catch {
          // Mutation hooks own error feedback; keep the form open for retry.
        } finally {
          submitLock.current = false;
        }
      })}
    >
      <p className="muted medication-form-note">
        {t("medications.persistence.formNotice")}
      </p>
      <Input
        label="اسم الدواء"
        maxLength={100}
        {...register("name")}
        error={errors.name?.message && t(errors.name.message)}
      />
      <Input
        label="الجرعة حسب الوصفة"
        placeholder="اكتب الجرعة الموصوفة لك"
        maxLength={100}
        {...register("dosage")}
        error={errors.dosage?.message && t(errors.dosage.message)}
      />
      <fieldset className="dose-fieldset">
        <legend>مواعيد يومية متكررة</legend>
        {fields.map((field, index) => (
          <div className="dose-input-row" key={field.id}>
            <Input
              label={`الموعد ${index + 1}`}
              type="time"
              {...register(`doses.${index}.time`)}
              error={errors.doses?.[index]?.time?.message}
            />
            <Button
              className="icon-button"
              variant="ghost"
              aria-label={`إزالة الموعد ${index + 1}`}
              disabled={fields.length === 1 || pending}
              onClick={() => remove(index)}
            >
              <X size={20} aria-hidden="true" />
            </Button>
          </div>
        ))}
        {(errors.doses?.message || errors.doses?.root?.message) && (
          <p role="alert" className="field-error">
            {errors.doses.message ?? errors.doses.root?.message}
          </p>
        )}
        <Button
          className="button"
          variant="secondary"
          disabled={fields.length >= 6 || pending}
          onClick={() => append({ time: "" })}
        >
          <Plus size={18} aria-hidden="true" />
          إضافة موعد
        </Button>
        <p className="medication-form-note muted">
          حتى 6 مواعيد يومية مختلفة لكل دواء في هذه النسخة.
        </p>
      </fieldset>
      <Input
        label="ملاحظات (اختياري)"
        maxLength={400}
        {...register("notes")}
        error={errors.notes?.message}
      />
      {initial && (
        <p className="medication-form-note muted">
          {t("medications.persistence.editHint")}
        </p>
      )}
      <Button type="submit" disabled={pending} data-i18n="declarative">
        {t(pending ? "measurements.ui.saving" : initial ? "measurements.ui.saveChanges" : "medications.add")}
      </Button>
    </form>
  );
}
