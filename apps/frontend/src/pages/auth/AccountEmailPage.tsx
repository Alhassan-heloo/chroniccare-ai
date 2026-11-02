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

export default function AccountEmailPage({ mode }: { mode: "activate-admin" | "forgot-password" | "reset-password" }) {
  const { t } = useI18n();
  const auth = useAuth();
  const [token] = useState(() => new URLSearchParams(location.hash.slice(1)).get("token") ?? "");
  useLayoutEffect(() => { if (location.hash) history.replaceState(null, "", location.pathname); }, []);
  const [name, setName] = useState(""), [email, setEmail] = useState("");
  const [password, setPassword] = useState(""), [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false), [done, setDone] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);
  const lock = useRef(false);
  const forgot = mode === "forgot-password", activation = mode === "activate-admin";
  async function submit(event: FormEvent) {
    event.preventDefault(); if (lock.current) return;
    setError(null);
    if (forgot ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) : password.length < 12 || password.length > 128) { setError(forgot ? "auth.emailInvalid" : "auth.passwordHint"); return; }
    if (!forgot && password !== confirm) { setError("auth.mismatch"); return; }
    if (activation && !name.trim()) { setError("auth.nameInvalid"); return; }
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
  return <PublicLayout><main id="public-content" className="living-auth route-content"><section className="auth-card glass stack">
    <h1>{t(forgot ? "accountEmail.forgot" : activation ? "accountEmail.activate" : "accountEmail.reset")}</h1>
    <p>{t(forgot ? "accountEmail.forgotIntro" : activation ? "accountEmail.activationIntro" : "accountEmail.resetIntro")}</p>
    {done ? <Feedback kind="success">{t(forgot ? "accountEmail.requested" : "accountEmail.completed")}</Feedback>
      : !forgot && !/^[a-f0-9]{64}$/.test(token) ? <Feedback kind="error">{t("accountEmail.invalid")}</Feedback>
        : <form onSubmit={submit} noValidate aria-busy={busy}><fieldset disabled={busy}>
          {activation && <Input label={t("auth.name")} value={name} onChange={event => setName(event.target.value)} autoComplete="name" maxLength={100} required />}
          {forgot ? <Input label={t("auth.email")} type="email" dir="ltr" value={email} onChange={event => setEmail(event.target.value)} autoComplete="username" maxLength={254} required />
            : <><Input label={t("auth.password")} type="password" dir="ltr" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} maxLength={128} required />
              <small>{t("auth.passwordHint")}</small><Input label={t("auth.confirmation")} type="password" dir="ltr" autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)} maxLength={128} required /></>}
          {error && <Feedback kind="error">{t(error)}</Feedback>}
          <Button type="submit" loading={busy}>{t(busy ? "auth.working" : forgot ? "accountEmail.request" : "common.actions.save")}</Button>
        </fieldset></form>}
    <Link to="/login">{t("auth.signIn")}</Link>
  </section></main></PublicLayout>;
}
