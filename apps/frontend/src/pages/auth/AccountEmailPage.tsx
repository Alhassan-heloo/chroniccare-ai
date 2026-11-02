import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { PublicLayout } from "@/components/public/PublicLayout";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Feedback } from "@/components/ui/Feedback";
import { apiRequest, AuthError } from "@/auth/api";
import { useI18n } from "@/i18n/context";
import type { TranslationKey } from "@/i18n/catalog";
import { useAuth } from "@/auth/context";
import { Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";

export default function AccountEmailPage({ mode }: { mode: "activate-admin" | "forgot-password" | "reset-password" }) {
  const { t } = useI18n();
  const auth = useAuth();
  const [token] = useState(() => new URLSearchParams(location.hash.slice(1)).get("token") ?? "");
  useLayoutEffect(() => { if (location.hash) history.replaceState(null, "", location.pathname); }, []);
  const [name, setName] = useState(""), [email, setEmail] = useState("");
  const [password, setPassword] = useState(""), [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false), [done, setDone] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);
  const [fields, setFields] = useState<Partial<Record<"name" | "email" | "password" | "confirm", TranslationKey>>>({});
  const [show, setShow] = useState(false);
  const lock = useRef(false);
  const forgot = mode === "forgot-password", activation = mode === "activate-admin";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (lock.current) return;
    setError(null);
    const invalid: typeof fields = {};
    if (forgot && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) invalid.email = "auth.emailInvalid";
    if (!forgot && (password.length < 12 || password.length > 128)) invalid.password = "auth.passwordHint";
    if (!forgot && password !== confirm) invalid.confirm = "auth.mismatch";
    if (activation && !name.trim()) invalid.name = "auth.nameInvalid";
    setFields(invalid);
    if (Object.keys(invalid).length) {
      const form = event.currentTarget;
      requestAnimationFrame(() => form.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    lock.current = true; setBusy(true);
    try {
      await apiRequest(`/accounts/${mode}`, { body: forgot ? { email: email.trim() } : { token, password, ...(activation ? { name: name.trim() } : {}) } });
      if (mode === "reset-password" && auth.user) await auth.logout().catch(() => undefined);
      setPassword(""); setConfirm(""); setDone(true);
    } catch (cause) {
      setError(cause instanceof AuthError && cause.code === "EMAIL_UNAVAILABLE" ? "accountEmail.unavailable"
        : cause instanceof AuthError && cause.code === "INVALID_ACCOUNT_LINK" ? "accountEmail.invalid"
          : cause instanceof AuthError && cause.code === "RATE_LIMITED" ? "auth.rateLimited" : "auth.failed");
    } finally { lock.current = false; setBusy(false); }
  }
  return <PublicLayout><main id="public-content" tabIndex={-1} className="account-recovery route-content"><section className="auth-card glass">
    <span className="account-symbol">{activation ? <ShieldCheck size={26} aria-hidden="true" /> : <KeyRound size={26} aria-hidden="true" />}</span>
    <h1>{t(forgot ? "accountEmail.forgot" : activation ? "accountEmail.activate" : "accountEmail.reset")}</h1>
    <p>{t(forgot ? "accountEmail.forgotIntro" : activation ? "accountEmail.activationIntro" : "accountEmail.resetIntro")}</p>
    {done ? <Feedback kind="success">{t(forgot ? "accountEmail.requested" : "accountEmail.completed")}</Feedback>
      : !forgot && !/^[a-f0-9]{64}$/.test(token) ? <Feedback kind="error">{t("accountEmail.invalid")}</Feedback>
        : <form onSubmit={submit} noValidate aria-busy={busy}><fieldset disabled={busy}>
          {activation && <Input label={t("auth.name")} value={name} error={fields.name && t(fields.name)} onChange={event => setName(event.target.value)} autoComplete="name" maxLength={100} required />}
          {forgot ? <Input label={t("auth.email")} type="email" dir="ltr" value={email} error={fields.email && t(fields.email)} onChange={event => setEmail(event.target.value)} autoComplete="username" maxLength={254} required />
            : <><div className="password-field"><Input id="recovery-password" label={t("auth.password")} type={show ? "text" : "password"} dir="ltr" autoComplete="new-password" value={password} hint={!fields.password ? t("auth.passwordHint") : undefined} error={fields.password && t(fields.password)} onChange={event => setPassword(event.target.value)} maxLength={128} required />
              <button type="button" className="password-toggle" aria-controls="recovery-password" aria-label={t(show ? "auth.hidePassword" : "auth.showPassword")} onClick={() => setShow(value => !value)}>{show ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}</button></div>
              <Input label={t("auth.confirmation")} type="password" dir="ltr" autoComplete="new-password" value={confirm} error={fields.confirm && t(fields.confirm)} onChange={event => setConfirm(event.target.value)} maxLength={128} required /></>}
          {error && <Feedback kind="error">{t(error)}</Feedback>}
          <Button type="submit" loading={busy}>{t(busy ? "auth.working" : forgot ? "accountEmail.request" : "common.actions.save")}</Button>
        </fieldset></form>}
    <Link to="/login">{t("auth.signIn")}</Link>
  </section></main></PublicLayout>;
}
