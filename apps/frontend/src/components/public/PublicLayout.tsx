import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { ArrowUp } from "lucide-react";
import { PublicHeader } from "./PublicHeader";
import { Mark } from "./living/ui";
import { useReducedMotion, useStoryMotion } from "./living/useLivingMotion";
import { scrollToSection } from "./living/useActiveSection";
import { useI18n } from "@/i18n/context";
import "@/styles/living-public.css";

/** The approved public shell is scoped: no tokens or motion escape into protected pages. */
export function PublicLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { pathname, hash, key } = useLocation();
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(() => { try { return localStorage.getItem("cc-public-motion") === "paused"; } catch { return false; } });
  useEffect(() => { try { localStorage.setItem("cc-public-motion", paused ? "paused" : "running"); } catch { /* Optional preference. */ } }, [paused]);
  useStoryMotion(pathname);
  useEffect(() => {
    if (pathname !== "/") return;
    const aliases: Record<string, string> = { "#features": "weekly-scene", "#product-preview": "product-preview", "#workflow": "workflow", "#assistant-preview": "assistant-scene" };
    if (aliases[hash]) scrollToSection(aliases[hash]);
  }, [pathname, hash, key]);
  return <div className={`living-public living-app page-${pathname === "/" ? "home" : "auth"}`} data-i18n="declarative" data-motion={paused || reduced ? "paused" : "running"}>
    <div className="atmosphere" aria-hidden="true"><span className="aurora aurora-blue" /><span className="aurora aurora-aqua" /><span className="atmosphere-grain" /></div>
    <PublicHeader paused={paused} reduced={reduced} onMotion={() => setPaused(value => !value)} />
    {children}
    <footer className="site-footer"><Link to="/" className="footer-brand"><Mark /><span>ChronicCare AI</span></Link><p>{t("public.living.footerNote")}<small>{t("public.living.footerPrivacy")}</small></p><button type="button" className="icon-button" aria-label={t("public.living.backTop")} onClick={() => window.scrollTo({ top: 0, behavior: paused || reduced ? "instant" : "smooth" })}><ArrowUp size={19} aria-hidden="true" /></button></footer>
  </div>;
}
