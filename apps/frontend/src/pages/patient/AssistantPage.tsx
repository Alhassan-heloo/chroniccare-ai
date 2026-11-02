import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowDown, MessageCircle, Plus, Send, ShieldCheck } from "lucide-react";
import { useAuth } from "@/auth/context";
import { AuthError } from "@/auth/api";
import { useI18n } from "@/i18n/context";
import { Button } from "@/components/ui/Button";
import { Feedback } from "@/components/ui/Feedback";
import { LivingPulse, SignatureArtwork } from "@/components/public/living/ui";
import { sendAssistantMessage, type AssistantReply } from "@/lib/api/assistant";
import type { TranslationKey } from "@/i18n/catalog";
type Turn = { id: number; text: string; language: "ar" | "en"; status: "pending" | "sent" | "failed"; answer?: AssistantReply };
const errors: Record<string, TranslationKey> = {
  NETWORK: "assistantChat.network", ASSISTANT_TIMEOUT: "assistantChat.timeout",
  ASSISTANT_RATE_LIMITED: "assistantChat.rate", RATE_LIMITED: "assistantChat.rate", ASSISTANT_BUSY: "assistantChat.busyError",
  ASSISTANT_NOT_CONFIGURED: "assistantChat.unavailable", ASSISTANT_PROVIDER_ERROR: "assistantChat.providerError",
  ASSISTANT_INVALID_RESPONSE: "assistantChat.invalidResponse", INVALID_RESPONSE: "assistantChat.invalidResponse",
  INVALID_ASSISTANT_MESSAGE: "assistantChat.invalidInput", ASSISTANT_REFUSED: "assistantChat.refused",
  UNAUTHENTICATED: "auth.expired", SESSION_CHANGED: "auth.expired",
};

export default function AssistantPage() {
  const { user } = useAuth();
  // Same-role account switches must not reuse another patient's component memory.
  return user?.role === "patient" ? <AssistantConversation key={user.id} /> : null;
}
function AssistantConversation() {
  const { request } = useAuth();
  const { t, language, formatNumber } = useI18n();
  const [turns, setTurns] = useState<Turn[]>([]), [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false), [failure, setFailure] = useState<{ turn: Turn; key: TranslationKey } | null>(null);
  const [inputError, setInputError] = useState(false), [showLatest, setShowLatest] = useState(false);
  const lock = useRef(false), live = useRef(true), serial = useRef(0), nearBottom = useRef(true);
  const controller = useRef<AbortController | null>(null), log = useRef<HTMLDivElement>(null), composer = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { live.current = true; return () => { live.current = false; controller.current?.abort(); }; }, []);
  useEffect(() => { if (nearBottom.current && log.current) log.current.scrollTop = log.current.scrollHeight; }, [turns, pending]);
  const latest = [...turns].reverse().find(turn => turn.answer)?.answer;
  async function send(retry?: Turn) {
    if (lock.current) return;
    const text = retry?.text ?? draft;
    if (!text.trim() || text.length > 2000) { setInputError(true); composer.current?.focus(); return; }
    const turn: Turn = retry ? { ...retry, status: "pending" } : { id: ++serial.current, text: text.trim(), language, status: "pending" };
    lock.current = true; setPending(true); setFailure(null); setInputError(false); nearBottom.current = true;
    setTurns(previous => retry ? previous.map(item => item.id === turn.id ? turn : item) : [...previous, turn]);
    if (!retry) setDraft("");
    const abort = new AbortController(); controller.current = abort;
    try {
      const answer = await sendAssistantMessage(request, turn.text, turn.language, abort.signal);
      if (live.current) setTurns(previous => previous.map(item => item.id === turn.id ? { ...item, status: "sent", answer } : item));
    } catch (cause) {
      if (live.current && !abort.signal.aborted) {
        setTurns(previous => previous.map(item => item.id === turn.id ? { ...item, status: "failed" } : item));
        setFailure({ turn, key: cause instanceof AuthError ? errors[cause.code] ?? "assistantChat.providerError" : "assistantChat.providerError" });
      }
    } finally {
      lock.current = false;
      if (live.current) setPending(false);
    }
  }
  function submit(event: FormEvent) { event.preventDefault(); void send(); }
  function enter(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); void send(); }
  }
  function clear() {
    if (lock.current) return;
    setTurns([]); setDraft(""); setFailure(null); setInputError(false); setShowLatest(false); nearBottom.current = true;
    composer.current?.focus();
  }
  return <div className="assistant-page stack" data-i18n="declarative">
    <header className="assistant-heading"><SignatureArtwork /><div><h1>{t("assistantChat.title")}</h1><p>{t("assistantChat.intro")}</p></div>
      <Button variant="secondary" disabled={pending || (!turns.length && !draft)} onClick={clear}><Plus size={18} aria-hidden="true" />{t("assistantChat.new")}</Button>
    </header>
    <aside className="assistant-safety" aria-label={t("assistantChat.safety")}>
      <p><ShieldCheck size={18} aria-hidden="true" />{t("assistantChat.education")}</p>
      <p className="assistant-emergency" lang={latest?.language} dir={latest?.language === "ar" ? "rtl" : latest ? "ltr" : undefined}>{latest?.emergencyGuidance ?? t("assistantChat.emergency")}</p>
      <p className="assistant-privacy">{t("assistantChat.privacy")}</p>
    </aside>
    <section className="assistant-workspace" aria-label={t("assistantChat.conversation")}>
      <LivingPulse cue={pending ? "waiting" : `answer-${turns.filter(turn => turn.answer).length}`} />
      <span className="sr-only" role="status">{pending ? t("assistantChat.loading") : ""}</span>
      <div ref={log} className="assistant-log" role="log" aria-label={t("assistantChat.conversation")} aria-live="polite" aria-relevant="additions text" aria-busy={pending} tabIndex={0}
        onScroll={() => { const element = log.current; if (element) { nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80; setShowLatest(!nearBottom.current); } }}>
        {!turns.length && <div className="assistant-empty"><MessageCircle size={34} aria-hidden="true" /><h2>{t("assistantChat.empty")}</h2><p>{t("assistantChat.emptyBody")}</p></div>}
        {turns.map(turn => <div key={turn.id} className="assistant-turn">
          <article className="assistant-message patient-message"><h2>{t("assistantChat.you")}</h2><p lang={turn.language} dir="auto">{turn.text}</p>
            {turn.status === "failed" && <small>{t("assistantChat.notAnswered")}</small>}
          </article>
          {turn.answer && <article className="assistant-message model-message"><h2>{t("assistantChat.name")}</h2><p lang={turn.answer.language} dir="auto">{turn.answer.reply}</p>
            <p className="assistant-disclaimer" lang={turn.answer.language} dir={turn.answer.language === "ar" ? "rtl" : "ltr"}>{turn.answer.disclaimer}</p>
          </article>}
        </div>)}
        {pending && <Feedback kind="loading">{t("assistantChat.loading")}</Feedback>}
      </div>
      {showLatest && <Button className="assistant-latest" variant="secondary" onClick={() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; nearBottom.current = true; setShowLatest(false); }}><ArrowDown size={16} aria-hidden="true" />{t("assistantChat.latest")}</Button>}
      {failure && <div className="assistant-error"><Feedback kind="error">{t(failure.key)}</Feedback><p>{t("assistantChat.retryHint")}</p><Button variant="secondary" disabled={pending} onClick={() => void send(failure.turn)}>{t("assistantChat.retry")}</Button></div>}
      <form className="assistant-composer" onSubmit={submit} aria-busy={pending}>
        <label htmlFor="assistant-message">{t("assistantChat.message")}</label>
        <textarea ref={composer} id="assistant-message" value={draft} onChange={event => { setDraft(event.target.value); setInputError(false); }} onKeyDown={enter}
          maxLength={2000} rows={3} readOnly={pending} aria-invalid={inputError} aria-describedby={`assistant-composer-hint assistant-character-count${inputError ? " assistant-input-error" : ""}`} placeholder={t("assistantChat.placeholder")} />
        {inputError && <p className="field-error" role="alert" id="assistant-input-error">{t("assistantChat.invalidInput")}</p>}
        <div className="assistant-composer-footer"><small id="assistant-composer-hint">{t("assistantChat.keyboard")}</small><span id="assistant-character-count" dir="ltr">{formatNumber(draft.length)} / {formatNumber(2000)}</span>
          <Button type="submit" loading={pending} disabled={!draft.trim() || pending}><Send size={17} aria-hidden="true" />{t("assistantChat.send")}</Button>
        </div>
        <p className="assistant-memory">{t("assistantChat.memory")}</p>
      </form>
    </section>
  </div>;
}
