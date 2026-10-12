import type { Language } from "./catalogTypes";
import { localeSettings } from "./locale";

export type HealthUnit = "mmHg" | "mg/dL";
export type DateInput = Date | string | number;
export type HabitUnit = "steps" | "cups" | "minutes" | "times";

export function createFormatters(language: Language) {
  const { locale } = localeSettings(language);
  const numberFormatter = new Intl.NumberFormat(locale);
  const pluralRules = new Intl.PluralRules(locale);
  const date = (input: DateInput, options: Intl.DateTimeFormatOptions = {}) =>
    new Intl.DateTimeFormat(locale, { calendar: "gregory", ...options }).format(new Date(input));
  return {
    formatHabitUnit: (unit: HabitUnit, count = 1) => {
      const singular = { steps: "step", cups: "cup", minutes: "minute", times: "time" };
      if (language === "en") return pluralRules.select(count) === "one" ? singular[unit] : `${singular[unit]}s`;
      const forms = { steps: ["خطوة", "خطوتان", "خطوات"], cups: ["كوب", "كوبان", "أكواب"], minutes: ["دقيقة", "دقيقتان", "دقائق"], times: ["مرة", "مرتان", "مرات"] } as const;
      const category = pluralRules.select(count);
      return forms[unit][category === "two" ? 1 : category === "few" ? 2 : 0] ?? forms[unit][0];
    },
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) =>
      options ? new Intl.NumberFormat(locale, options).format(value) : numberFormatter.format(value),
    formatDate: date,
    formatTime: (input: DateInput, options?: Intl.DateTimeFormatOptions) =>
      date(input, { hour: "2-digit", minute: "2-digit", ...options }),
    formatDateTime: (input: DateInput, options?: Intl.DateTimeFormatOptions) =>
      date(input, { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", ...options }),
    // Standard clinical symbols retain their existing spelling in both languages.
    formatUnit: (unit: HealthUnit) => unit,
  };
}
