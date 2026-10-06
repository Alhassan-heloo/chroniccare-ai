import { Bot, ArrowUpLeft, Sparkles } from "lucide-react";
import { Link } from "react-router";
export function AssistantCard() {
  return (
    <section className="assistant-card" aria-labelledby="assistant-heading">
      <span className="assistant-eyebrow">
        <Sparkles size={16} /> رفيق رحلتك الصحية
      </span>
      <div className="assistant-orb">
        <Bot size={44} />
      </div>
      <h2 id="assistant-heading">المساعد الصحي</h2>
      <p>كيف يمكنني مساعدتك اليوم؟</p>
      <Link className="btn btn-primary" to="/patient/assistant">
        اسأل المساعد <ArrowUpLeft size={20} />
      </Link>
      <small>قريبًا · غير متصل بالذكاء الاصطناعي</small>
    </section>
  );
}
