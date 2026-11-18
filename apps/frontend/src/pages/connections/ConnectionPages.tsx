import { useRef, useState } from "react";
import { useConnections } from "@/hooks/queries/useConnections";
import { useI18n } from "@/i18n/context";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Feedback } from "@/components/ui/Feedback";
import { AuthError } from "@/auth/api";
import type { DoctorIdentity } from "@/lib/api/connections";
import type { TranslationKey } from "@/i18n/catalog";
import { PageHeading } from "@/components/ui/PageHeading";
import { Modal } from "@/components/ui/Modal";
import { CopyButton } from "@/components/ui/CopyButton";
import { Footprints, HeartPulse, KeyRound, Pill, ShieldCheck, UserRoundCheck } from "lucide-react";
import "@/styles/evolution/clinical.css";

function message(error: unknown): TranslationKey {
  if (error instanceof AuthError) {
    if (error.code === "RATE_LIMITED") return "auth.rateLimited";
    if (["INVALID_INPUT", "CONNECTION_CODE_INVALID"].includes(error.code)) return "connections.invalid";
  }
  return "connections.failed";
}

export function ConnectPatientPage() {
  const { generate, invite } = useConnections();
  const { t, formatDateTime, language } = useI18n();
  const lock = useRef(false);
  const [email, setEmail] = useState("");
  const [invalidEmail, setInvalidEmail] = useState(false);
  const emailInput = useRef<HTMLInputElement>(null);
  const link = invite.data ? `${window.location.origin}/patient/invitation#token=${invite.data.token}` : "";
  return <div className="doctor-page stack connection-page evolution-clinical" data-i18n="declarative">
    <PageHeading title={t("finalExperience.invite")} description={t("finalExperience.invitationHint")} />
    <Card className="stack targeted-invitation-card">
      <form className="stack" noValidate aria-busy={invite.isPending} onSubmit={async event=>{
        event.preventDefault();if(lock.current)return;
        if(email.trim().length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())){setInvalidEmail(true);emailInput.current?.focus();return;}
        lock.current=true;invite.reset();
        try{await invite.mutateAsync(email.trim());}catch{/* Inline mutation feedback. */}finally{lock.current=false;}
      }}><Input ref={emailInput} label={t("finalExperience.invitationEmail")} type="email" dir="ltr" autoComplete="off" maxLength={254} required value={email} disabled={invite.isPending} error={invalidEmail ? t("admin.emailInvalid") : undefined} onChange={event=>{setEmail(event.target.value);setInvalidEmail(false);invite.reset();}} />
      <Button type="submit" loading={invite.isPending}>{t("finalExperience.issue")}</Button></form>
      {invite.isError && <Feedback kind="error">{t(message(invite.error))}</Feedback>}
      {invite.data && <><Feedback>{t("finalExperience.issued")}</Feedback><div className="field"><label htmlFor="patient-invitation-link">{t("finalExperience.invitationTitle")}</label><textarea className="resize-none" id="patient-invitation-link" dir="ltr" rows={3} readOnly value={link} autoComplete="off" spellCheck={false} onFocus={event=>event.target.select()} /></div><CopyButton key={link} value={link} label={t("finalExperience.copy")} /><time dateTime={invite.data.expiresAt}>{t("connections.expires",{date:formatDateTime(invite.data.expiresAt)})}</time></>}
    </Card>
    <details className="manual-connection"><summary>{t("finalExperience.manual")}</summary>
    <div className="connection-generation-workspace"><Card className="stack connection-code-card">
      <div className="connection-key-heading"><span className="clinical-panel-symbol"><KeyRound size={28} aria-hidden="true" /></span><div><h2>{t("connections.code")}</h2><p>{language === "ar" ? "رمز واحد. مريض واحد." : "One code. One patient."}</p></div></div>
      <Button loading={generate.isPending} onClick={async () => {
        if (lock.current) return;
        lock.current = true; generate.reset();
        try { await generate.mutateAsync(); } catch { /* Visible mutation feedback. */ }
        finally { lock.current = false; }
      }}>{t("connections.generate")}</Button>
      {generate.isError && <Feedback kind="error">{t(message(generate.error))}</Feedback>}
      {generate.data && <>
        <div className="field connection-generated-code"><label htmlFor="generated-connection-code">{t("connections.code")}</label><textarea className="resize-none" id="generated-connection-code" value={generate.data.code} readOnly dir="ltr" rows={3} spellCheck={false} autoComplete="off" onFocus={event => event.target.select()} /></div>
        <CopyButton key={generate.data.code} value={generate.data.code} label={t("finalExperience.copy")} />
        <p className="connection-expiration"><time dateTime={generate.data.expiresAt}>{t("connections.expires", { date: formatDateTime(generate.data.expiresAt) })}</time></p>
        <Feedback>{t("connections.share")}</Feedback>
      </>}
    </Card><aside className="connection-process"><h2>{language === "ar" ? "كيف يتم الاتصال؟" : "How connection works"}</h2><ol><li><strong>{language === "ar" ? "أنشئ رمزًا خاصًا" : "Generate a private code"}</strong><p>{language === "ar" ? "الرمز صالح لمدة عشر دقائق ولموافقة واحدة." : "The code is valid for ten minutes and one approval."}</p></li><li><strong>{language === "ar" ? "شاركه مع المريض" : "Share it with your patient"}</strong><p>{language === "ar" ? "يراجع المريض هوية حسابك قبل الموافقة." : "Your patient reviews your account identity before approving."}</p></li><li><strong>{language === "ar" ? "اقرأ السجل المصرّح به" : "View the authorized record"}</strong><p>{t("doctor.readOnlyNotice")}</p></li></ol></aside></div>
    </details>
  </div>;
}

export function MyDoctorsPage() {
  const { list, preview, approve, revoke } = useConnections();
  const { t, language, formatNumber } = useI18n();
  const [code, setCode] = useState("");
  const [review, setReview] = useState<{ code: string; doctor: DoctorIdentity } | null>(null);
  const [error, setError] = useState<TranslationKey | null>(null);
  const [success, setSuccess] = useState<TranslationKey | null>(null);
  const [removing, setRemoving] = useState<DoctorIdentity | null>(null);
  const [codeError, setCodeError] = useState(false);
  const codeInput = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const busy = preview.isPending || approve.isPending || revoke.isPending;
  async function act(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setError(null); setSuccess(null);
    try { await action(); } catch (cause) { setError(message(cause)); setReview(null); }
    finally { lock.current = false; }
  }
  return <div className="doctor-page stack connection-page evolution-clinical" data-i18n="declarative">
    <PageHeading title={t("connections.myDoctors")} description={t("connections.patientIntro")} action={<a className="btn btn-primary connection-review-jump" href="#connection-code-review">{t("connections.review")}</a>} />
    <div className="connection-workspace">
    <section className="stack connection-current" aria-labelledby="connection-current-title"><div className="clinical-region-heading"><h2 id="connection-current-title">{t("connections.current")}</h2>{list.data && <span className="clinical-count">{formatNumber(list.data.doctors.length)}</span>}</div>
    {list.isPending ? <Feedback kind="loading">{t("doctor.loading")}</Feedback>
      : list.isError ? <Feedback kind="error" action={<Button onClick={() => void list.refetch()}>{t("common.actions.retry")}</Button>}>{t("connections.failed")}</Feedback>
        : list.data?.doctors.length ? <ul className="doctor-patient-list">{list.data.doctors.map(doctor => <li key={doctor.id}>
          <Card className="stack connection-doctor-row"><div className="connection-doctor-identity"><span className="doctor-patient-avatar" aria-hidden="true">{doctor.name.slice(0, 1)}</span><div><h3><bdi>{doctor.name}</bdi></h3><p><bdi>{doctor.email}</bdi></p></div></div>
            <p className="connection-approval-state"><UserRoundCheck size={17} aria-hidden="true" />{t(doctor.approvedAt ? "connections.patientApproved" : "connections.legacy")}</p>
            <Button variant="secondary" disabled={busy} onClick={() => setRemoving(doctor)}>{t("connections.revoke")}</Button>
          </Card></li>)}</ul> : <Feedback kind="empty">{t("connections.empty")}</Feedback>}
      <div className="connection-permissions"><ShieldCheck size={23} aria-hidden="true" /><div><strong>{language === "ar" ? "أنت تتحكم في الوصول" : "You control access"}</strong><p>{language === "ar" ? "مشاركة للقراءة فقط. يمكنك إلغاء الوصول في أي وقت." : "Share read-only access. Revoke it at any time."}</p></div><ul><li><HeartPulse size={16} aria-hidden="true" />{t("common.navigation.measurements")}</li><li><Pill size={16} aria-hidden="true" />{t("common.navigation.medications")}</li><li><Footprints size={16} aria-hidden="true" />{t("common.navigation.habits")}</li></ul></div>
    </section>
    <Card className="stack connection-review-card"><h2 id="connection-code-review" tabIndex={-1}><KeyRound size={21} aria-hidden="true" />{t("connections.review")}</h2><p className="connection-code-intro">{language === "ar" ? "هل لديك رمز من طبيبك؟ أدخله لمراجعة هويته أولًا." : "Have a code from your doctor? Enter it to review their identity first."}</p><form className="stack" noValidate onSubmit={event => {
      event.preventDefault();
      if (!code.trim()) { setCodeError(true); codeInput.current?.focus(); return; }
      void act(async () => { const result = await preview.mutateAsync(code.trim()); setReview({ code: code.trim(), doctor: result.doctor }); });
    }}><Input ref={codeInput} label={t("connections.code")} value={code} dir="ltr" autoComplete="off" maxLength={32} disabled={busy} error={codeError ? t("validation.required") : undefined}
      onChange={event => { setCode(event.target.value); setCodeError(false); setReview(null); setError(null); setSuccess(null); }} />
      <Button type="submit" disabled={busy} loading={preview.isPending}>{t("connections.review")}</Button>
    </form>
      {review && <section className="stack" aria-label={t("connections.review")}>
        <h2><bdi>{review.doctor.name}</bdi></h2><p><bdi>{review.doctor.email}</bdi></p>
        <Feedback>{t("connections.consent")}</Feedback>
        <Button disabled={busy} loading={approve.isPending} onClick={() => void act(async () => {
          await approve.mutateAsync(review.code); setReview(null); setCode(""); setSuccess("connections.approved");
        })}>{t("connections.approve")}</Button>
        <Button variant="secondary" disabled={busy} onClick={() => setReview(null)}>{t("connections.cancel")}</Button>
      </section>}
      {error && <Feedback kind="error">{t(error)}</Feedback>}
      {success && <Feedback kind="success">{t(success)}</Feedback>}
    </Card></div>
    <Modal open={Boolean(removing)} dismissible={!busy} onClose={() => { if (!busy) setRemoving(null); }} title={t("connections.revoke")} declarativeTitle>
      <div className="stack" data-i18n="declarative"><p>{t("experience.revokeConfirm", { name: removing?.name ?? "" })}</p>
        {error && <Feedback kind="error">{t(error)}</Feedback>}
        <div className="confirmation-actions"><Button variant="secondary" disabled={busy} onClick={() => setRemoving(null)}>{t("connections.cancel")}</Button>
          <Button variant="danger" loading={revoke.isPending} onClick={() => { if (removing) void act(async () => { await revoke.mutateAsync(removing.id); setRemoving(null); setSuccess("connections.revoked"); }); }}>{t("connections.revoke")}</Button></div>
      </div>
    </Modal>
  </div>;
}
