import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemeMode } from "@/theme/context";
import { useI18n } from "@/i18n/context";
import { Button } from "@/components/ui/Button";

export function Preferences() {
  const { mode, setMode, toggle } = useTheme();
  const { language, setLanguage, t } = useI18n();
  const nextMode = mode === "light" ? "dark" : mode === "dark" ? "system" : "light";
  const themeAction = t("common.preferences.nextTheme", { theme: t(`common.theme.${nextMode}`) });
  return <div className="preferences" data-i18n="declarative">
    <Button variant="ghost" className="theme-toggle" onClick={toggle} aria-label={themeAction} title={themeAction}>
      {nextMode === "system" ? <Monitor size={20} aria-hidden="true" /> : nextMode === "light" ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
    </Button>
    <label className="sr-only" htmlFor="theme-mode">{t("common.theme.label")}</label>
    <select id="theme-mode" className="theme-select" value={mode} onChange={(event) => setMode(event.target.value as ThemeMode)} aria-label={t("common.theme.label")}>
      <option value="light">{t("common.theme.light")}</option><option value="dark">{t("common.theme.dark")}</option><option value="system">{t("common.theme.system")}</option>
    </select>
    <button className="language-toggle" type="button" onClick={() => setLanguage(language === "ar" ? "en" : "ar")} aria-label={t(language === "ar" ? "common.preferences.switchEnglish" : "common.preferences.switchArabic")}>
      <span className={language === "ar" ? "active" : ""}>{t("common.preferences.arabic")}</span><span aria-hidden="true">/</span><span className={language === "en" ? "active" : ""}>{t("common.preferences.english")}</span>
    </button>
  </div>;
}
