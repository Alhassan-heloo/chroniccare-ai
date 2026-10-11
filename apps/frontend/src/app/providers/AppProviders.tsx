import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { queryClient } from "@/lib/query/queryClient";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { I18nProvider } from "@/i18n/I18nProvider";
import { useI18n } from "@/i18n/context";
import { useTheme } from "@/theme/context";
function Feedback({ children }: { children: ReactNode }) {
  const { language } = useI18n();
  const { resolved } = useTheme();
  return <>{children}<Toaster theme={resolved} dir={language === "ar" ? "rtl" : "ltr"} position="top-center" richColors closeButton /></>;
}
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider><I18nProvider><QueryClientProvider client={queryClient}>
      <Feedback>{children}</Feedback>
    </QueryClientProvider></I18nProvider></ThemeProvider>
  );
}
