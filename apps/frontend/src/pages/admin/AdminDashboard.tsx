import { useRef, useState, type FormEvent } from "react";
import { RefreshCw, ShieldCheck, UserPlus, Users } from "lucide-react";
import { AuthError } from "@/auth/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Feedback } from "@/components/ui/Feedback";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useAdminDoctors, useCreateDoctor } from "@/hooks/queries/useAdminDoctors";
import { useI18n } from "@/i18n/context";
import type { TranslationKey } from "@/i18n/catalog";
import type { DoctorInvitation } from "@/lib/types/admin";
import "@/styles/evolution/clinical.css";

type Field = "name" | "email";
const errorKeys: Record<string, TranslationKey> = {
  ACCOUNT_EXISTS: "admin.duplicate", INVALID_INPUT: "admin.invalid", NETWORK: "admin.network",
  INVITATION_EXISTS: "admin.invitationExists", EMAIL_UNAVAILABLE: "accountEmail.unavailable", EMAIL_DELIVERY_FAILED: "admin.deliveryFailed",
};

export default function AdminDashboard() {
  const { t, formatNumber } = useI18n();
  const doctors = useAdminDoctors();
  const create = useCreateDoctor();
  const submitting = useRef(false);
  const [name, setName] = useState(""), [email, setEmail] = useState("");
  const [created, setCreated] = useState<DoctorInvitation | null>(null);
  const [creationOpen, setCreationOpen] = useState(false);
  const [fields, setFields] = useState<Partial<Record<Field, TranslationKey>>>({});
  const [error, setError] = useState<TranslationKey | null>(null);

  function clearField(field: Field) {
    setFields(previous => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || create.isPending) return;
    const invalid: typeof fields = {};
    if (!name.trim() || name.trim().length > 100) invalid.name = "admin.nameInvalid";
    if (email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) invalid.email = "admin.emailInvalid";
    setFields(invalid); setError(null); setCreated(null);
    if (Object.keys(invalid).length) {
      const form = event.currentTarget;
      requestAnimationFrame(() => form.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    submitting.current = true;
    try {
      const invitation = await create.mutateAsync({ name: name.trim(), email: email.trim() });
      setCreated(invitation); setName(""); setEmail("");
    } catch (cause) {
      setError(cause instanceof AuthError ? errorKeys[cause.code] ?? "admin.failed" : "admin.failed");
    } finally { submitting.current = false; }
  }

  return <div className="admin-page stack evolution-clinical evolution-admin" data-i18n="declarative">
    <header className="admin-heading">
      <div className="admin-heading-copy"><span className="clinical-role-label"><ShieldCheck size={17} aria-hidden="true" />{t("admin.eyebrow")}</span><h1>{t("admin.dashboard")}</h1><p>{t("admin.description")}</p></div>
      <nav className="admin-jump-nav" aria-label={t("admin.dashboard")}>
        <Button className="admin-open-create" onClick={() => setCreationOpen(true)}><UserPlus size={18} aria-hidden="true" />{t("admin.createTitle")}</Button>
        <a href="#admin-doctors-title"><Users size={18} aria-hidden="true" />{t("admin.listTitle")}</a>
      </nav>
    </header>
    <div className="admin-overview">
      <dl><div><dt>{t("admin.doctorCount")}</dt><dd>{!doctors.isError && doctors.data ? formatNumber(doctors.data.length) : "—"}</dd></div>
        <div><dt>{t("admin.patientAccess")}</dt><dd><ShieldCheck size={16} aria-hidden="true" />{t("admin.noAutomaticAccess")}</dd></div></dl>
      <p>{t("admin.scopeNotice")}</p>
    </div>
    <div className="admin-workspace">
      <section className="admin-list-section" aria-labelledby="admin-doctors-title">
        <div className="admin-section-heading"><Users size={22} aria-hidden="true" /><div><h2 id="admin-doctors-title" tabIndex={-1}>{t("admin.listTitle")}</h2><p>{t("admin.listDescription")}</p></div></div>
        {doctors.isPending ? <Feedback kind="loading">{t("admin.loading")}</Feedback>
          : doctors.isError || !doctors.data ? <Feedback kind="error" action={<Button variant="secondary" onClick={() => void doctors.refetch()}><RefreshCw size={17} aria-hidden="true" />{t("common.actions.retry")}</Button>}>{t("admin.loadFailed")}</Feedback>
            : doctors.data.length ? <><div className="admin-ledger-labels" aria-hidden="true"><span>{t("admin.name")}</span><span>{t("admin.email")}</span><span>{t("admin.doctorRole")}</span></div><ul className="admin-doctor-list">{doctors.data.map(doctor => <li key={doctor.id}><Card className="admin-doctor-card"><span className="admin-doctor-avatar" aria-hidden="true">{doctor.name.slice(0, 1)}</span><h3><bdi>{doctor.name}</bdi></h3><a href={`mailto:${doctor.email}`} dir="ltr">{doctor.email}</a><span className="admin-role-badge">{t("admin.doctorRole")}</span></Card></li>)}</ul></>
              : <Feedback kind="empty">{t("admin.empty")}</Feedback>}
      </section>
    </div>
    <Modal open={creationOpen} dismissible={!create.isPending} onClose={() => { if (!create.isPending) setCreationOpen(false); }} title={t("admin.createTitle")} declarativeTitle>
      <Card className="admin-create-card" padding="comfortable">
        <p id="admin-create-title" className="admin-create-description">{t("admin.createDescription")}</p>
        {created && <Feedback kind="success">{t("admin.createdSuccess", { name: `\u2068${created.name}\u2069` })}</Feedback>}
        {error && <Feedback kind="error">{t(error)}</Feedback>}
        <form onSubmit={submit} noValidate aria-busy={create.isPending}>
          <fieldset disabled={create.isPending}>
            <div className="admin-identity-fields">
            <Input label={t("admin.name")} value={name} onChange={event => { setName(event.target.value); clearField("name"); }} autoComplete="name" maxLength={100} required error={fields.name && t(fields.name)} />
            <Input label={t("admin.email")} type="email" dir="ltr" value={email} onChange={event => { setEmail(event.target.value); clearField("email"); }} autoComplete="username" maxLength={254} required error={fields.email && t(fields.email)} />
            </div>
            <Button type="submit" loading={create.isPending}><UserPlus size={18} aria-hidden="true" />{t(create.isPending ? "admin.creating" : "admin.create")}</Button>
          </fieldset>
        </form>
      </Card>
    </Modal>
  </div>;
}
