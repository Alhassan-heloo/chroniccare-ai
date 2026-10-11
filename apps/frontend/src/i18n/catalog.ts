import type {
  CatalogKey,
  Language,
  TranslationVariables,
} from "./catalogTypes";
import { arCatalog } from "./locales/ar";
import { enCatalog } from "./locales/en";
import { inspectMessage, reportTranslationIssue } from "./safety";

export type TranslationKey = CatalogKey<typeof arCatalog>;

export const catalogs = {
  ar: arCatalog,
  en: enCatalog,
} as const;

function flattenCatalog(
  value: object,
  prefix = "",
  target = new Map<string, string>(),
) {
  for (const [key, entry] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof entry === "string") target.set(path, entry);
    else if (entry && typeof entry === "object") {
      flattenCatalog(entry, path, target);
    }
  }
  return target;
}

const flattenedCatalogs = {
  ar: flattenCatalog(arCatalog),
  en: flattenCatalog(enCatalog),
};
const catalogKeys = new Set(flattenedCatalogs.ar.keys());

function interpolate(message: string, variables?: TranslationVariables) {
  if (!variables) return message;
  return message.replace(/\{\{(\w+)\}\}/g, (placeholder, name: string) =>
    Object.hasOwn(variables, name) ? String(variables[name]) : placeholder,
  );
}

export function isTranslationKey(value: string): value is TranslationKey {
  return catalogKeys.has(value);
}

export function translateCatalogMessage(
  language: Language,
  key: TranslationKey,
  variables?: TranslationVariables,
) {
  const message = flattenedCatalogs[language].get(key);
  reportTranslationIssue(key, inspectMessage(message, variables), import.meta.env?.DEV === true);
  return interpolate(message ?? key, variables);
}

export function getCatalogKeys(language: Language) {
  return [...flattenedCatalogs[language].keys()].sort();
}

export function findMissingTranslationKeys(
  referenceLanguage: Language,
  candidateLanguage: Language,
) {
  const candidate = flattenedCatalogs[candidateLanguage];
  return getCatalogKeys(referenceLanguage).filter((key) => !candidate.has(key));
}

export function findUnusedTranslationKeys(usedKeys: Iterable<string>) {
  const used = new Set(usedKeys);
  return getCatalogKeys("ar").filter((key) => !used.has(key));
}

export function auditTranslationCatalogs(usedKeys: Iterable<string>) {
  return {
    missingInArabic: findMissingTranslationKeys("en", "ar"),
    missingInEnglish: findMissingTranslationKeys("ar", "en"),
    unused: findUnusedTranslationKeys(usedKeys),
  };
}
