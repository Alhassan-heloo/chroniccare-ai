import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router";
import { ArrowUp } from "lucide-react";
import { PublicHeader } from "./PublicHeader";
import { Brand } from "@/components/layout/Brand";
import { useReducedMotion } from "./living/useLivingMotion";
import { scrollToSection } from "./living/useActiveSection";
import { useI18n } from "@/i18n/context";
import "@/styles/evolution/public.css";

/** Living Evolution public presentation; authentication and role access are unchanged. */
export function PublicLayout({ children, homepageDemoLabel }: { children: ReactNode; homepageDemoLabel?: string }) {
  const { t } = useI18n();
  const { pathname, hash, key } = useLocation();
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(() => { try { return localStorage.getItem("cc-public-motion") === "paused"; } catch { return false; } });
  useEffect(() => { try { localStorage.setItem("cc-public-motion", paused ? "paused" : "running"); } catch { /* Optional preference. */ } }, [paused]);
  useEffect(() => {
    if (pathname !== "/") return;
    const aliases: Record<string, string> = { "#features": "product-preview", "#product-preview": "product-preview", "#workflow": "product-preview", "#assistant-preview": "product-preview" };
    const target = aliases[hash];
    if (target) {
      document.getElementById(target)?.focus({ preventScroll: true });
      scrollToSection(target);
    }
  }, [pathname, hash, key]);
  return <div className={`living-public living-app living-evolution evolution-public page-${pathname === "/" ? "home" : "auth"}`} data-i18n="declarative" data-motion={paused || reduced ? "paused" : "running"}>
    <PublicHeader homepageDemoLabel={homepageDemoLabel} paused={paused} reduced={reduced} onMotion={() => setPaused(value => !value)} />
    {children}
    <footer className="site-footer"><Brand /><p>{t("public.living.footerNote")}<small>{t("public.living.footerPrivacy")}</small></p><button type="button" className="icon-button" aria-label={t("public.living.backTop")} onClick={() => window.scrollTo({ top: 0, behavior: paused || reduced ? "instant" : "smooth" })}><ArrowUp size={19} aria-hidden="true" /></button></footer>
  </div>;
}
