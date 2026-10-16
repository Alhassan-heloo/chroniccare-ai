import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";
import { Brand } from "@/components/layout/Brand";
import { Preferences } from "@/components/layout/Preferences";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n/context";
import { useAuth } from "@/auth/context";
import { AuthError, safeReturnTo } from "@/auth/api";
import type { TranslationKey } from "@/i18n/catalog";
const errorKeys: Record<string, TranslationKey> = {
  INVALID_CREDENTIALS: "auth.incorrect", ACCOUNT_EXISTS: "auth.duplicate", INVALID_INPUT: "auth.invalid",
  RATE_LIMITED: "auth.rateLimited", UNAUTHENTICATED: "auth.expired", NETWORK: "auth.network",
};
export default function AuthPage({ mode }: { mode: "login" | "register" }) {
  const auth = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const register = mode === "register";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);
  const [fields, setFields] = useState<Partial<Record<"name" | "email" | "password" | "confirmation", TranslationKey>>>({});
  const returnTo = params.get("returnTo");
  const suffix = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";
  if (auth.user) return <Navigate replace to={safeReturnTo(returnTo, auth.user.role)} />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const invalid: typeof fields = {};
    if (register && (!name.trim() || name.trim().length > 100)) invalid.name = "auth.nameInvalid";
    if (email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) invalid.email = "auth.emailInvalid";
    if (password.length < 12 || password.length > 128) invalid.password = "auth.passwordHint";
    if (register && confirmation !== password) invalid.confirmation = "auth.mismatch";
    setFields(invalid); setError(null);
    if (Object.keys(invalid).length) {
      const form = event.currentTarget;
      requestAnimationFrame(() => form.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setBusy(true);
    try {
      if (register) {
        await auth.register(name.trim(), email.trim(), password);
        setPassword(""); setConfirmation("");
        navigate(`/login?registered=1${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ""}`, { replace: true });
      } else {
        const user = await auth.login(email.trim(), password);
        setPassword(""); navigate(safeReturnTo(returnTo, user.role), { replace: true });
      }
    } catch (cause) {
      setError(cause instanceof AuthError ? errorKeys[cause.code] ?? "auth.failed" : "auth.failed");
    } finally { setBusy(false); }
  }
  return <main className="public-shell auth-shell" data-i18n="declarative">
    <div className="auth-heading"><Brand /><Preferences /></div>
    <section className="card auth-card" aria-labelledby="auth-title">
      <span className="eyebrow">ChronicCare AI</span>
      <h1 id="auth-title">{t(register ? "auth.register" : "auth.signIn")}</h1>
      <p className="muted">{t(register ? "auth.registerIntro" : "auth.loginIntro")}</p>
      {auth.expired && <p role="status">{t("auth.expired")}</p>}
      {!register && params.get("registered") === "1" && <p role="status">{t("auth.created")}</p>}
      <form onSubmit={submit} noValidate aria-busy={busy}>
        <fieldset disabled={busy}>
          {register && <Input label={t("auth.name")} value={name} onChange={e => setName(e.target.value)} autoComplete="name" maxLength={100} required error={fields.name && t(fields.name)} />}
          <Input label={t("auth.email")} type="email" dir="ltr" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" maxLength={254} required error={fields.email && t(fields.email)} />
          <Input label={t("auth.password")} type={show ? "text" : "password"} dir="ltr" value={password} onChange={e => setPassword(e.target.value)} autoComplete={register ? "new-password" : "current-password"} minLength={12} maxLength={128} required error={fields.password && t(fields.password)} />
          <small className="muted">{t("auth.passwordHint")}</small>
          <Button variant="ghost" aria-pressed={show} onClick={() => setShow(!show)}>{t(show ? "auth.hidePassword" : "auth.showPassword")}</Button>
          {register && <Input label={t("auth.confirmation")} type={show ? "text" : "password"} dir="ltr" value={confirmation} onChange={e => setConfirmation(e.target.value)} autoComplete="new-password" maxLength={128} required error={fields.confirmation && t(fields.confirmation)} />}
          {error && <p className="field-error" role="alert">{t(error)}</p>}
          <Button type="submit">{t(busy ? "auth.working" : register ? "auth.register" : "auth.signIn")}</Button>
        </fieldset>
      </form>
      <p><Link to={`${register ? "/login" : "/register"}${suffix}`}>{t(register ? "auth.haveAccount" : "auth.needAccount")}</Link></p>
      <p className="muted">{t("auth.memoryNotice")}</p>
      <p className="muted">{t("auth.dataNotice")}</p>
      <Button variant="secondary" disabled={busy} onClick={async () => {
        setBusy(true); setError(null);
        try { await auth.enterDemo(); navigate("/patient/dashboard"); }
        catch { setError("auth.network"); } finally { setBusy(false); }
      }}>{t("auth.exploreDemo")}</Button>
    </section>
    <Link to="/">{t("auth.backHome")}</Link>
  </main>;
}
