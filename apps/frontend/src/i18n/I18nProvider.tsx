import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { I18nContext, type I18nValue, type Language } from "./context";
import { translateToEnglish } from "./translate";
import { isInsideChart, updateTextIfChanged } from "./domTranslation";
type TranslationRecord = { source: string; translated: string };
const originalText = new WeakMap<Node, TranslationRecord>();
const originalAttributes = new WeakMap<Element, Map<string, TranslationRecord>>();

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => typeof window !== "undefined" && localStorage.getItem("cc-language") === "en" ? "en" : "ar");
  const setLanguage = useCallback((next: Language) => { localStorage.setItem("cc-language", next); setLanguageState(next); }, []);
  const t = useCallback((value: string) => language === "ar" ? value : translateToEnglish(value), [language]);
  useEffect(() => {
    const root = document.documentElement;
    root.lang = language;
    root.dir = language === "ar" ? "rtl" : "ltr";
    document.title = language === "ar" ? "ChronicCare AI | رعاية صحية يومية" : "ChronicCare AI | Daily health care";
    const translateNode = (node: Node) => {
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
  const locale = language === "ar" ? "ar-SA-u-nu-latn" : "en-US";
  const value = useMemo<I18nValue>(() => ({ language, setLanguage, t, locale, formatNumber: (number) => new Intl.NumberFormat(locale).format(number), formatDate: (input, options) => new Intl.DateTimeFormat(locale, { calendar: "gregory", ...options }).format(new Date(input)) }), [language, locale, setLanguage, t]);
  return <I18nContext value={value}>{children}</I18nContext>;
}
