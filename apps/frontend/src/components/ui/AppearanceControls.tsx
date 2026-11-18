import { Monitor, Moon, Sun } from "lucide-react";
export function ThemeToggle({ dark, label, onClick, className, nextTheme }: {
  dark: boolean; label: string; onClick: () => void; className?: string; nextTheme?: "light" | "dark" | "system";
}) {
  const icons = { light: Sun, dark: Moon, system: Monitor };
  const Icon = icons[nextTheme ?? (dark ? "light" : "dark")];
  return <button type="button" className={className} aria-label={label} title={label} aria-pressed={dark} onClick={onClick}>
    <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
  </button>;
}
export function LanguageSwitch({ language, label, onClick, className }: {
  language: "ar" | "en"; label: string; onClick: () => void; className?: string;
}) {
  const target = language === "ar" ? "en" : "ar";
  return <button type="button" className={className} lang={language} aria-label={label} onClick={onClick}>
    {target === "en" ? "التبديل إلى الإنجليزية" : "Switch to Arabic"}
  </button>;
}
