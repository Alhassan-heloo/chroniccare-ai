import { useEffect } from "react";
import { useLocation } from "react-router";
import { useI18n } from "@/i18n/context";
import { useTheme } from "@/theme/context";
import { useAuth } from "@/auth/context";
import { roleHome } from "@/auth/api";
import Homepage from "../../../homepage-hybrid/Homepage";
import "../../../homepage-hybrid/hybrid.css";

const previousSections: Record<string, string> = {
  "#features": "showcase",
  "#product-preview": "readings",
  "#workflow": "journey",
  "#assistant-preview": "assistant",
};

export default function HybridHomePage() {
  const { language, setLanguage } = useI18n();
  const { resolved, setMode } = useTheme();
  const { hash } = useLocation();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!hash) return;
    let active = true;
    // Resolve legacy links after the local fonts settle; an initial smooth scroll
    // can be interrupted by mobile browser scroll restoration during navigation.
    void document.fonts.ready.then(() => {
      if (active) document.getElementById(previousSections[hash] ?? hash.slice(1))
        ?.scrollIntoView({ behavior: previousSections[hash] ? "instant" : "auto" });
    });
    return () => { active = false; };
  }, [hash]);

  return <Homepage
    language={language}
    session={loading ? "loading" : user?.role ?? "guest"}
    workspaceHref={user ? roleHome(user.role) : "/login"}
    dark={resolved === "dark"}
    onLanguage={setLanguage}
    onTheme={() => setMode(resolved === "dark" ? "light" : "dark")}
  />;
}
