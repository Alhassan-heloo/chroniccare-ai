import { createContext, useContext } from "react";
import type { TranslationKey } from "./catalog";
import type { Language, TranslationVariables } from "./catalogTypes";
import { createFormatters } from "./formatters";
import { localeSettings } from "./locale";
import { isTranslationKey, translateCatalogMessage } from "./catalog";

export type { Language } from "./catalogTypes";
export type Translate = {
  (key: TranslationKey, variables?: TranslationVariables): string;
  (legacyArabicText: string): string;
};
export type I18nValue = ReturnType<typeof createFormatters> & {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Translate;
  locale: string;
  direction: "rtl" | "ltr";
  isRtl: boolean;
};

const fallbackI18n: I18nValue = {
  language: "ar",
  setLanguage: () => undefined,
  t: (value: string, variables?: TranslationVariables) => isTranslationKey(value) ? translateCatalogMessage("ar", value, variables) : value,
  ...localeSettings("ar"),
  ...createFormatters("ar"),
};

export const I18nContext = createContext<I18nValue | null>(null);
export function useI18n() { return useContext(I18nContext) ?? fallbackI18n; }
