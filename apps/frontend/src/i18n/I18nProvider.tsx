import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { I18nContext, type I18nValue, type Language } from "./context";
import { translateToEnglish } from "./translate";
import { isInsideChart, updateTextIfChanged } from "./domTranslation";
import { isTranslationKey, translateCatalogMessage } from "./catalog";
import type { TranslationVariables } from "./catalogTypes";
import { reportTranslationIssue } from "./safety";
import { applyDocumentLanguage, localeSettings, restoreBrowserLanguage, saveBrowserLanguage } from "./locale";
import { createFormatters } from "./formatters";
type TranslationRecord = { source: string; translated: string };
const originalText = new WeakMap<Node, TranslationRecord>();
const originalAttributes = new WeakMap<Element, Map<string, TranslationRecord>>();

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(restoreBrowserLanguage);
  const setLanguage = useCallback((next: Language) => { saveBrowserLanguage(next); setLanguageState(next); }, []);
  const t = useCallback((value: string, variables?: TranslationVariables) => {
    if (isTranslationKey(value)) {
      return translateCatalogMessage(language, value, variables);
    }
    if (/^[a-z]+\.[\w.]+$/.test(value)) {
      reportTranslationIssue(value, ["missing-key"], import.meta.env?.DEV === true);
    }
    return language === "ar" ? value : translateToEnglish(value);
  }, [language]);
  useEffect(() => {
    const root = document.documentElement;
    applyDocumentLanguage(root, language);
    document.title = language === "ar" ? "ChronicCare AI | رعاية صحية يومية" : "ChronicCare AI | Daily health care";
    const translateNode = (node: Node) => {
      const element = node instanceof Element ? node : node.parentElement;
      if (element?.closest('[data-i18n="declarative"]')) return;
      // Recharts owns and frequently reconciles this subtree in response to
      // ResizeObserver. Its labels are localized through React props instead.
      if (isInsideChart(node)) return;
      if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
        const current = node.textContent;
        const previous = originalText.get(node);
        const source = !previous || (current !== previous.source && current !== previous.translated) ? current : previous.source;
        const translated = translateToEnglish(source);
        originalText.set(node, { source, translated });
        updateTextIfChanged(node, language === "en" ? translated : source);
      }
      if (node instanceof HTMLElement) for (const attr of ["aria-label", "title", "placeholder"]) {
        const value = node.getAttribute(attr); if (!value) continue;
        const values = originalAttributes.get(node) ?? new Map<string, TranslationRecord>();
        const previous = values.get(attr);
        const source = !previous || (value !== previous.source && value !== previous.translated) ? value : previous.source;
        const translated = translateToEnglish(source);
        values.set(attr, { source, translated });
        originalAttributes.set(node, values);
        const next = language === "en" ? translated : source;
        if (value !== next) node.setAttribute(attr, next);
      }
      node.childNodes.forEach(translateNode);
    };
    translateNode(document.body);
    const observer = new MutationObserver((records) => records.forEach((record) => {
      record.addedNodes.forEach(translateNode);
    }));
    // Observe insertion only. Watching characterData/attributes here causes a
    // feedback loop with libraries such as Recharts that reconcile the same
    // SVG accessibility nodes from ResizeObserver callbacks.
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [language]);
  const value = useMemo<I18nValue>(() => ({ language, setLanguage, t, ...localeSettings(language), ...createFormatters(language) }), [language, setLanguage, t]);
  return <I18nContext value={value}>{children}</I18nContext>;
}
