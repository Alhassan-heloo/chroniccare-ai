import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemeMode } from "@/theme/context";
import { useI18n } from "@/i18n/context";
import { Button } from "@/components/ui/Button";

export function Preferences() {
  const { mode, resolved, setMode, toggle } = useTheme();
  const { language, setLanguage, t } = useI18n();
  return <div className="preferences">
    <Button variant="ghost" className="theme-toggle" onClick={toggle} aria-label={t(resolved === "dark" ? "تفعيل المظهر الفاتح" : "تفعيل المظهر الداكن")} title={t(resolved === "dark" ? "المظهر الفاتح" : "المظهر الداكن")}>
      {mode === "system" ? <Monitor size={20} /> : resolved === "dark" ? <Sun size={20} /> : <Moon size={20} />}
    </Button>
    <label className="sr-only" htmlFor="theme-mode">{t("نمط المظهر")}</label>
    <select id="theme-mode" className="theme-select" value={mode} onChange={(event) => setMode(event.target.value as ThemeMode)} aria-label={t("نمط المظهر")}>
      <option value="light">{t("فاتح")}</option><option value="dark">{t("داكن")}</option><option value="system">{t("النظام")}</option>
    </select>
    <button className="language-toggle" type="button" onClick={() => setLanguage(language === "ar" ? "en" : "ar")} aria-label={language === "ar" ? "Switch to English" : "التبديل إلى العربية"}>
      <span className={language === "ar" ? "active" : ""}>العربية</span><span aria-hidden="true">/</span><span className={language === "en" ? "active" : ""}>EN</span>
    </button>
  </div>;
}
