import { useId } from "react";
import { useTheme, type ThemeMode } from "@/theme/context";
import { useI18n } from "@/i18n/context";
import { LanguageSwitch, ThemeToggle } from "@/components/ui/AppearanceControls";
export type PatientTextSize = "normal" | "large" | "extra-large";
export type PatientTextPreference = { size: PatientTextSize; setSize: (size: PatientTextSize) => void };
const textSizes: PatientTextSize[] = ["normal", "large", "extra-large"];

export function Preferences({ patientText }: { patientText?: PatientTextPreference }) {
  const id = useId();
  const textSizeId = `${id}-text-size`;
  const { mode, resolved, setMode, toggle } = useTheme();
  const { language, setLanguage, t } = useI18n();
  const dark = resolved === "dark";
  const nextMode = mode === "light" ? "dark" : mode === "dark" ? "system" : "light";
  const themeAction = t("common.preferences.nextTheme", { theme: t(`common.theme.${nextMode}`) });
  return <div className="preferences" data-i18n="declarative">
    <div className="preference-field">
      <label htmlFor={id}>{t("common.theme.label")}</label>
      <div className="preference-theme">
        <select id={id} aria-label={t("common.theme.label")} className="theme-select" value={mode} onChange={event => setMode(event.target.value as ThemeMode)}>
          <option value="light">{t("common.theme.light")}</option>
          <option value="dark">{t("common.theme.dark")}</option>
          <option value="system">{t("common.theme.system")}</option>
        </select>
        <ThemeToggle className="icon-button theme-toggle" dark={dark} nextTheme={nextMode} label={themeAction} onClick={toggle} />
      </div>
    </div>
    <div className="preference-field">
      <span>{t("common.preferences.language")}</span>
      <LanguageSwitch className="language-toggle" language={language} label={t(language === "ar" ? "common.preferences.switchEnglish" : "common.preferences.switchArabic")} onClick={() => setLanguage(language === "ar" ? "en" : "ar")} />
    </div>
    {patientText && <div className="preference-field preference-text-size">
      <label htmlFor={textSizeId}>{t("common.preferences.textSize")}</label>
      <select id={textSizeId} value={patientText.size} onChange={event => patientText.setSize(event.target.value as PatientTextSize)}>
        {textSizes.map(size => <option key={size} value={size}>{t(`common.preferences.textSizes.${size}`)}</option>)}
      </select>
    </div>}
  </div>;
}
