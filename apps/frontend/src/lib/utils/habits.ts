import { z } from "zod";
import type { Habit } from "@/lib/types/habit";
import { localDateKey } from "./measurementFilters";
export const habitUnits = {
  steps: "خطوة",
  minutes: "دقيقة",
  cups: "كوب",
  times: "مرة",
} as const;
export const habitSchema = z.object({
  title: z.string().trim().min(2, "أدخل اسم العادة").max(80, "الاسم طويل جدًا"),
  unit: z.enum(["steps", "minutes", "cups", "times"]),
  target: z
    .number({ error: "أدخل هدفًا رقميًا" })
    .int("أدخل عددًا صحيحًا")
    .min(1, "يجب أن يكون الهدف أكبر من صفر")
    .max(100000, "تحقق من الهدف"),
});
export const habitProgressSchema = z
  .number({ error: "أدخل رقمًا صحيحًا" })
  .int("أدخل عددًا صحيحًا")
  .min(0, "لا يمكن أن يكون التقدم سالبًا")
  .max(100000, "تحقق من القيمة");
export const habitDay = () => localDateKey(new Date().toISOString());
export const progressToday = (habit: Habit, day = habitDay()) =>
  habit.recordedOn === day ? habit.progress : 0;
export const habitPercent = (habit: Habit) =>
  Math.min(100, Math.round((progressToday(habit) / habit.target) * 100));
