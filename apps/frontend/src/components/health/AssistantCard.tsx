import { Bot, ArrowUpLeft, Sparkles, ChevronDown } from "lucide-react";
import { Link } from "react-router";
import { useI18n } from "@/i18n/context";
export function AssistantCard({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  if (compact) return <details className="dashboard-assistant glass" data-i18n="declarative">
    <summary><span className="dashboard-feature-icon"><Bot size={23} aria-hidden="true" /></span><span><h2>{t("common.navigation.assistant")}</h2><small>{t("patient.overview.assistantUnavailable")}</small></span><ChevronDown size={18} aria-hidden="true" /></summary>
    <div className="dashboard-assistant-body"><p>{t("patient.overview.assistantQuestion")}</p><Link className="btn btn-secondary" to="/patient/assistant">{t("patient.overview.askAssistant")}<ArrowUpLeft size={18} aria-hidden="true" /></Link></div>
  </details>;
  return (
    <section className="assistant-card" aria-labelledby="assistant-heading" data-i18n="declarative">
      <span className="assistant-eyebrow">
        <Sparkles size={16} /> {t("patient.overview.companion")}
      </span>
      <div className="assistant-orb">
        <Bot size={44} />
      </div>
      <h2 id="assistant-heading">{t("common.navigation.assistant")}</h2>
      <p>{t("patient.overview.assistantQuestion")}</p>
      <Link className="btn btn-primary" to="/patient/assistant">
        {t("patient.overview.askAssistant")} <ArrowUpLeft size={20} />
      </Link>
      <small>{t("patient.overview.assistantUnavailable")}</small>
    </section>
  );
}
