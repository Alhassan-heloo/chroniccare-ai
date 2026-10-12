import type { TranslationKey } from "./catalog";
const messages: Record<string, TranslationKey> = {
  "أدخل اسم العادة": "habits.ui.invalidName", "الاسم طويل جدًا": "habits.ui.longName",
  "أدخل هدفًا رقميًا": "habits.ui.numericGoal", "أدخل عددًا صحيحًا": "habits.ui.integer",
  "يجب أن يكون الهدف أكبر من صفر": "habits.ui.positiveGoal", "تحقق من الهدف": "habits.ui.checkGoal",
  "أدخل رقمًا صحيحًا": "habits.ui.invalidNumber", "لا يمكن أن يكون التقدم سالبًا": "habits.ui.negative",
  "تحقق من القيمة": "habits.ui.checkValue",
};
export function habitValidationKey(message: string): TranslationKey {
  return messages[message] ?? "habits.ui.checkValue";
}
