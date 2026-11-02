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
    <h1>{t("connections.connect")}</h1><p>{t("connections.doctorIntro")}</p>
    <Card className="stack">
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
  const lock = useRef(false);
  const busy = preview.isPending || approve.isPending || revoke.isPending;
  async function act(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setError(null); setSuccess(null);
    try { await action(); } catch (cause) { setError(message(cause)); setReview(null); }
    finally { lock.current = false; }
  }
  return <div className="doctor-page stack connection-page" data-i18n="declarative">
    <h1>{t("connections.myDoctors")}</h1><p>{t("connections.patientIntro")}</p>
    <Card className="stack"><form className="stack" noValidate onSubmit={event => {
      event.preventDefault();
      void act(async () => { const result = await preview.mutateAsync(code.trim()); setReview({ code: code.trim(), doctor: result.doctor }); });
    }}><Input label={t("connections.code")} value={code} dir="ltr" autoComplete="off" maxLength={32} disabled={busy}
      onChange={event => { setCode(event.target.value); setReview(null); setError(null); setSuccess(null); }} />
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
    <h2>{t("connections.current")}</h2>
    {list.isPending ? <Feedback kind="loading">{t("doctor.loading")}</Feedback>
      : list.isError ? <Feedback kind="error" action={<Button onClick={() => void list.refetch()}>{t("common.actions.retry")}</Button>}>{t("connections.failed")}</Feedback>
        : list.data?.doctors.length ? <ul className="doctor-patient-list">{list.data.doctors.map(doctor => <li key={doctor.id}>
          <Card className="stack"><h3><bdi>{doctor.name}</bdi></h3><p><bdi>{doctor.email}</bdi></p>
            <p>{t(doctor.approvedAt ? "connections.patientApproved" : "connections.legacy")}</p>
            <Button variant="secondary" disabled={busy} onClick={() => void act(async () => {
              await revoke.mutateAsync(doctor.id); setSuccess("connections.revoked");
            })}>{t("connections.revoke")}</Button>
          </Card></li>)}</ul> : <Feedback kind="empty">{t("connections.empty")}</Feedback>}
  </div>;
}
