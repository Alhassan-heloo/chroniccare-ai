import { z } from "zod";
export const medicationSchema = z.object({
  name: z.string().trim().min(2, "أدخل اسم الدواء").max(100, "الاسم طويل جدًا"),
  dosage: z
    .string()
    .trim()
    .min(1, "أدخل الجرعة كما في الوصفة")
    .max(100, "الجرعة طويلة جدًا"),
  notes: z.string().trim().max(400, "الحد الأقصى 400 حرف"),
  doses: z
    .array(
      z.object({
        time: z
          .string()
          .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "اختر وقتًا صحيحًا"),
      }),
    )
    .min(1, "أضف موعدًا واحدًا على الأقل")
    .max(6, "الحد الأقصى في النسخة التجريبية 6 مواعيد")
    .refine(
      (doses) => new Set(doses.map((dose) => dose.time)).size === doses.length,
      "لا تكرر موعدًا لنفس الدواء",
    ),
});
