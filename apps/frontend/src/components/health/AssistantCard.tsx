import { Bot, ArrowUpLeft, Sparkles } from "lucide-react";
import { Link } from "react-router";
import { useI18n } from "@/i18n/context";
export function AssistantCard() {
  const { t } = useI18n();
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
