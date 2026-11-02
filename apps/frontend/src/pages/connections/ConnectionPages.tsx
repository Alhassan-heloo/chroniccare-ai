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
import { KeyRound, ShieldCheck } from "lucide-react";

function message(error: unknown): TranslationKey {
  if (error instanceof AuthError) {
    if (error.code === "RATE_LIMITED") return "auth.rateLimited";
    if (["INVALID_INPUT", "CONNECTION_CODE_INVALID"].includes(error.code)) return "connections.invalid";
  }
  return "connections.failed";
}

export function ConnectPatientPage() {
  const { generate } = useConnections();
  const { t, formatDateTime } = useI18n();
  const lock = useRef(false);
  return <div className="doctor-page stack connection-page" data-i18n="declarative">
    <PageHeading title={t("connections.connect")} description={t("connections.doctorIntro")} eyebrow={t("doctor.eyebrow")} />
    <Card className="stack connection-code-card">
      <KeyRound className="connection-symbol" size={28} aria-hidden="true" />
      <Button loading={generate.isPending} onClick={async () => {
        if (lock.current) return;
        lock.current = true; generate.reset();
        try { await generate.mutateAsync(); } catch { /* Visible mutation feedback. */ }
        finally { lock.current = false; }
      }}>{t("connections.generate")}</Button>
      {generate.isError && <Feedback kind="error">{t(message(generate.error))}</Feedback>}
      {generate.data && <>
        <Input label={t("connections.code")} value={generate.data.code} readOnly dir="ltr" autoComplete="off" onFocus={event => event.target.select()} />
        <p>{t("connections.expires", { date: formatDateTime(generate.data.expiresAt) })}</p>
        <Feedback>{t("connections.share")}</Feedback>
      </>}
    </Card>
  </div>;
}

export function MyDoctorsPage() {
  const { list, preview, approve, revoke } = useConnections();
  const { t } = useI18n();
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
  return <div className="doctor-page stack connection-page" data-i18n="declarative">
    <PageHeading title={t("connections.myDoctors")} description={t("connections.patientIntro")} />
    <div className="connection-workspace"><Card className="stack connection-review-card"><h2><ShieldCheck size={21} aria-hidden="true" />{t("connections.review")}</h2><form className="stack" noValidate onSubmit={event => {
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
    </Card>
    <section className="stack connection-current" aria-labelledby="connection-current-title"><h2 id="connection-current-title">{t("connections.current")}</h2>
    {list.isPending ? <Feedback kind="loading">{t("doctor.loading")}</Feedback>
      : list.isError ? <Feedback kind="error" action={<Button onClick={() => void list.refetch()}>{t("common.actions.retry")}</Button>}>{t("connections.failed")}</Feedback>
        : list.data?.doctors.length ? <ul className="doctor-patient-list">{list.data.doctors.map(doctor => <li key={doctor.id}>
          <Card className="stack"><h3><bdi>{doctor.name}</bdi></h3><p><bdi>{doctor.email}</bdi></p>
            <p>{t(doctor.approvedAt ? "connections.patientApproved" : "connections.legacy")}</p>
            <Button variant="secondary" disabled={busy} onClick={() => setRemoving(doctor)}>{t("connections.revoke")}</Button>
          </Card></li>)}</ul> : <Feedback kind="empty">{t("connections.empty")}</Feedback>}</section></div>
    <Modal open={Boolean(removing)} dismissible={!busy} onClose={() => { if (!busy) setRemoving(null); }} title={t("connections.revoke")} declarativeTitle>
      <div className="stack" data-i18n="declarative"><p>{t("experience.revokeConfirm", { name: removing?.name ?? "" })}</p>
        {error && <Feedback kind="error">{t(error)}</Feedback>}
        <div className="confirmation-actions"><Button variant="secondary" disabled={busy} onClick={() => setRemoving(null)}>{t("connections.cancel")}</Button>
          <Button loading={revoke.isPending} onClick={() => { if (removing) void act(async () => { await revoke.mutateAsync(removing.id); setRemoving(null); setSuccess("connections.revoked"); }); }}>{t("connections.revoke")}</Button></div>
      </div>
    </Modal>
  </div>;
}
