import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";
import { Eye, EyeOff, ShieldCheck, ArrowRight, HeartPulse, Pill, Footprints } from "lucide-react";
import { PublicLayout } from "@/components/public/PublicLayout";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Feedback } from "@/components/ui/Feedback";
import { SignatureArtwork, LivingPulse } from "@/components/public/living/ui";
import { useI18n } from "@/i18n/context";
import { useAuth } from "@/auth/context";
import { apiRequest, AuthError, safeReturnTo } from "@/auth/api";
import type { TranslationKey } from "@/i18n/catalog";
const errorKeys: Record<string, TranslationKey> = {
  INVALID_CREDENTIALS: "auth.incorrect", ACCOUNT_EXISTS: "auth.duplicate", INVALID_INPUT: "auth.invalid",
  RATE_LIMITED: "auth.rateLimited", UNAUTHENTICATED: "auth.expired", NETWORK: "auth.network",
  INVALID_SETUP_CODE: "setup.invalidCode", SETUP_CLOSED: "setup.closed",
};
export default function AuthPage({ mode }: { mode: "login" | "register" | "setup" }) {
  const auth = useAuth();
  const { t, language } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const setup = mode === "setup";
  const register = mode !== "login";
  const [setupCode, setSetupCode] = useState("");
  const [available, setAvailable] = useState<boolean | null>(null);
  const [statusFailed, setStatusFailed] = useState(false);
  const [statusAttempt, setStatusAttempt] = useState(0);
  const submitting = useRef(false);
  useEffect(() => {
    let live = true;
    void apiRequest<{ available: boolean }>("/setup").then(result => {
      if (live) { setAvailable(result.available); setStatusFailed(false); }
    }).catch(() => { if (live) setStatusFailed(true); });
    return () => { live = false; };
  }, [statusAttempt]);
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
  if (auth.loading) return <PublicLayout><Feedback kind="loading">{t("auth.working")}</Feedback></PublicLayout>;
  if (auth.user) return <Navigate replace to={safeReturnTo(returnTo, auth.user.role)} />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
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
    if (setup && !setupCode) { setError("setup.invalidCode"); return; }
    submitting.current = true; setBusy(true);
    try {
      if (register) {
        if (setup) await apiRequest("/setup", { body: { setupCode, name: name.trim(), email: email.trim(), password } });
        else await auth.register(name.trim(), email.trim(), password);
        setSetupCode("");
        setPassword(""); setConfirmation("");
        navigate(`/login?${setup ? "setup=1" : "registered=1"}${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ""}`, { replace: true });
      } else {
        const user = await auth.login(email.trim(), password);
        setPassword(""); navigate(safeReturnTo(returnTo, user.role), { replace: true });
      }
    } catch (cause) {
      if (setup && cause instanceof AuthError && cause.code === "SETUP_CLOSED") setAvailable(false);
      setError(cause instanceof AuthError ? errorKeys[cause.code] ?? "auth.failed" : "auth.failed");
    } finally { submitting.current = false; setBusy(false); }
  }
  return <PublicLayout>
    <main id="public-content" className={`evolution-auth route-content${register ? " register-auth" : ""}`} tabIndex={-1} data-i18n="declarative">
    <section className="auth-card auth-form-portal" aria-labelledby="auth-title">
      <div className="auth-portal-heading"><span className="auth-purpose"><ShieldCheck size={18} aria-hidden="true" />{t(setup ? "setup.title" : register ? "public.patientOnly" : "public.authEyebrow")}</span>
      <h1 id="auth-title">{t(setup ? "setup.title" : register ? "auth.register" : "auth.signIn")}</h1>
      <p className="muted">{t(setup ? "setup.intro" : register ? "auth.registerIntro" : "auth.loginIntro")}</p></div>
      {auth.expired && <Feedback>{t("auth.expired")}</Feedback>}
      {!register && params.get("registered") === "1" && <Feedback kind="success">{t("auth.created")}</Feedback>}
      {!register && params.get("setup") === "1" && <Feedback kind="success">{t("setup.created")}</Feedback>}
      {setup && available !== true && <Feedback kind={statusFailed ? "error" : "info"}>{t(statusFailed ? "auth.network" : available === false ? "setup.closed" : "setup.loading")}</Feedback>}
      {setup && statusFailed && <Button onClick={() => setStatusAttempt(value => value + 1)}>{t("setup.retry")}</Button>}
      {(!setup || available === true) && <form onSubmit={submit} noValidate aria-busy={busy}>
        <fieldset disabled={busy}>
          {setup && <Input label={t("setup.code")} type="password" dir="ltr" value={setupCode} onChange={e => setSetupCode(e.target.value)} autoComplete="off" maxLength={512} required />}
          <div className="auth-identity-fields">
          {register && <Input label={t("auth.name")} value={name} onChange={e => setName(e.target.value)} autoComplete="name" maxLength={100} required error={fields.name && t(fields.name)} />}
          <Input label={t("auth.email")} type="email" dir="ltr" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" maxLength={254} required error={fields.email && t(fields.email)} />
          </div>
          <div className="auth-password-fields">
          <div className="password-field">
            <Input id="auth-password" label={t("auth.password")} type={show ? "text" : "password"} dir="ltr" value={password} onChange={e => setPassword(e.target.value)} autoComplete={register ? "new-password" : "current-password"} minLength={12} maxLength={128} required error={fields.password && t(fields.password)} aria-describedby={fields.password ? "auth-password-error" : "password-hint"} />
            <button className="password-toggle" type="button" aria-controls="auth-password" aria-label={t(show ? "auth.hidePassword" : "auth.showPassword")} title={t(show ? "auth.hidePassword" : "auth.showPassword")} aria-pressed={show} onClick={() => setShow(!show)}>{show ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}</button>
          </div>
          {register && <Input label={t("auth.confirmation")} type={show ? "text" : "password"} dir="ltr" value={confirmation} onChange={e => setConfirmation(e.target.value)} autoComplete="new-password" maxLength={128} required error={fields.confirmation && t(fields.confirmation)} />}
          {!fields.password && <small className="muted password-hint" id="password-hint">{t("auth.passwordHint")}</small>}
          </div>
          {error && <Feedback kind="error">{t(error)}</Feedback>}
          <Button type="submit" loading={busy}>{t(busy ? "auth.working" : setup ? "setup.create" : register ? "auth.register" : "auth.signIn")}</Button>
        </fieldset>
      </form>}
      {!register && available === true && <p className="auth-switch"><Link to="/setup">{t("setup.title")}</Link></p>}
      {!register && <p className="auth-switch"><Link to="/forgot-password">{t("accountEmail.forgot")}</Link></p>}
      <p className="auth-switch"><Link to={`${register ? "/login" : "/register"}${suffix}`}>{t(register ? "auth.haveAccount" : "auth.needAccount")}</Link></p>
      <p className="auth-security"><ShieldCheck size={18} aria-hidden="true" />{t("auth.memoryNotice")}</p>
      <p className="auth-data-note">{t("auth.dataNotice")}</p>
      <Link className="auth-home-link" to="/"><ArrowRight size={17} aria-hidden="true" />{t("auth.backHome")}</Link>
    </section>
    <aside className="evolution-auth-story" aria-labelledby="auth-story-title">
      <div className="auth-story-art"><SignatureArtwork /></div>
      <div className="auth-story-copy"><span className="auth-story-emblem"><HeartPulse size={32} aria-hidden="true" /></span>
      <h2 id="auth-story-title">{language === "ar" ? "رعايتك اليومية، في صورة واحدة." : "Your daily care, in one connected view."}</h2>
      <p>{t("public.living.productSummary")}</p></div>
      <div className="auth-story-overview">
        <div><HeartPulse size={22} aria-hidden="true" /><span>{t("measurements.title")}</span></div>
        <div><Pill size={22} aria-hidden="true" /><span>{t("common.navigation.medications")}</span></div>
        <div><Footprints size={22} aria-hidden="true" /><span>{t("habits.title")}</span></div>
      </div>
      <div className="auth-story-assurance"><ShieldCheck size={21} aria-hidden="true" /><p>{language === "ar" ? "أنت تختار الطبيب الذي يمكنه الاطلاع على سجلاتك." : "You choose which doctor can view your records."}</p></div>
      <LivingPulse cue={mode} />
    </aside>
    </main>
  </PublicLayout>;
}
