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
export function MedicationForm({
  initial,
  onSaved,
}: {
  initial?: Medication;
  onSaved: () => void;
}) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
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
  const pending = add.isPending || update.isPending;
  return (
    <form
      className="stack"
      noValidate
      onSubmit={handleSubmit((input) => {
        if (initial)
          update.mutate({ id: initial.id, input }, { onSuccess: onSaved });
        else add.mutate(input, { onSuccess: onSaved });
      })}
    >
      <p className="muted medication-form-note">
        أدخل الاسم والجرعة والمواعيد كما في وصفتك. التطبيق لا يقترح أدوية أو
        جرعات.
      </p>
      <Input
        label="اسم الدواء"
        maxLength={100}
        {...register("name")}
        error={errors.name?.message}
      />
      <Input
        label="الجرعة حسب الوصفة"
        placeholder="اكتب الجرعة الموصوفة لك"
        maxLength={100}
        {...register("dosage")}
        error={errors.dosage?.message}
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
              variant="ghost"
              aria-label={`إزالة الموعد ${index + 1}`}
              disabled={fields.length === 1 || pending}
              onClick={() => remove(index)}
            >
              <X size={20} />
            </Button>
          </div>
        ))}
        {(errors.doses?.message || errors.doses?.root?.message) && (
          <p role="alert" className="field-error">
            {errors.doses.message ?? errors.doses.root?.message}
          </p>
        )}
        <Button
          variant="secondary"
          disabled={fields.length >= 6 || pending}
          onClick={() => append({ time: "" })}
        >
          <Plus size={18} />
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
          المواعيد التي تبقى كما هي تحتفظ بحالة التناول. حذف موعد يلغي سجله،
          والموعد الجديد يبدأ دون تسجيل.
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "جارٍ الحفظ…" : initial ? "حفظ التعديلات" : "إضافة الدواء"}
      </Button>
    </form>
  );
}
