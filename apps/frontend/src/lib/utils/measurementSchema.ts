import { z } from "zod";
const positive = z
  .number({ error: "أدخل رقمًا صحيحًا" })
  .positive("يجب أن تكون القيمة أكبر من صفر")
  .finite();
// Technical bounds only; these are not clinical thresholds or a diagnosis.
export const measurementSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("bloodPressure"),
      systolic: positive.max(400, "تحقق من القراءة").int(),
      diastolic: positive.max(300, "تحقق من القراءة").int(),
    })
    .refine((data) => data.systolic > data.diastolic, {
      path: ["diastolic"],
      message: "الضغط الانبساطي يجب أن يكون أقل من الانقباضي",
    }),
  z.object({
    kind: z.literal("glucose"),
    value: positive.max(1500, "تحقق من القراءة"),
  }),
]);
