import type { Language } from "./catalogTypes";

export const LANGUAGE_STORAGE_KEY = "cc-language";
type LanguageStorage = Pick<Storage, "getItem" | "setItem">;

export function readLanguage(storage: LanguageStorage): Language {
  try { return storage.getItem(LANGUAGE_STORAGE_KEY) === "en" ? "en" : "ar"; }
  catch { return "ar"; }
}

export function persistLanguage(storage: LanguageStorage, language: Language) {
  try { storage.setItem(LANGUAGE_STORAGE_KEY, language); } catch { /* Preferences remain usable when storage is blocked. */ }
}

export function localeSettings(language: Language) {
  return {
    locale: language === "ar" ? "ar-SA-u-nu-latn" : "en-US",
    direction: language === "ar" ? "rtl" as const : "ltr" as const,
    isRtl: language === "ar",
  };
}

export function applyDocumentLanguage(root: Pick<HTMLElement, "lang" | "dir">, language: Language) {
  root.lang = language;
  root.dir = localeSettings(language).direction;
}

export function restoreBrowserLanguage(): Language {
  try { return typeof window === "undefined" ? "ar" : readLanguage(window.localStorage); }
  catch { return "ar"; }
}

export function saveBrowserLanguage(language: Language) {
  try { persistLanguage(window.localStorage, language); } catch { /* Access to localStorage itself may throw. */ }
}
