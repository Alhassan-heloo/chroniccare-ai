import { Bot, LockKeyhole, MessageSquare } from "lucide-react";
import { useI18n } from "@/i18n/context";

export function AssistantPreview() {
  const { t } = useI18n();
  return <div className="assistant-interface" data-i18n="declarative">
    <div className="assistant-interface-header"><span className="product-icon"><Bot size={22} aria-hidden="true" /></span><strong>{t("common.navigation.assistant")}</strong><span className="product-status">{t("public.next.aiStatus")}</span></div>
    <div className="assistant-question"><span><MessageSquare size={17} aria-hidden="true" />{t("public.next.questionLabel")}</span><blockquote>{t("public.next.question")}</blockquote></div>
    <p className="assistant-disclosure"><LockKeyhole size={18} aria-hidden="true" />{t("public.next.aiNoResponse")}</p>
  </div>;
}
