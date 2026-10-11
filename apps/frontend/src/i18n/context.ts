import { createContext, useContext } from "react";

export type Language = "ar" | "en";
export type I18nValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (value: string) => string;
  locale: string;
  formatNumber: (value: number) => string;
  formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
};

const fallbackLocale = "ar-SA-u-nu-latn";
const fallbackI18n: I18nValue = {
  language: "ar",
  setLanguage: () => undefined,
  t: (value) => value,
  locale: fallbackLocale,
  formatNumber: (value) => new Intl.NumberFormat(fallbackLocale).format(value),
  formatDate: (value, options) => new Intl.DateTimeFormat(fallbackLocale, { calendar: "gregory", ...options }).format(new Date(value)),
};

export const I18nContext = createContext<I18nValue | null>(null);
export function useI18n() { return useContext(I18nContext) ?? fallbackI18n; }
