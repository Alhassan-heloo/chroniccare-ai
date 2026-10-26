import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";
import { Eye, EyeOff, ShieldCheck, ArrowRight } from "lucide-react";
import { PublicLayout } from "@/components/public/PublicLayout";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Feedback } from "@/components/ui/Feedback";
import { HealthCanvas } from "@/components/public/living/HealthCanvas";
import { SignatureArtwork, LivingPulse } from "@/components/public/living/ui";
import { useLivingPresentation } from "@/components/public/living/presentation";
import { previewReadings, type Kind } from "@/components/public/living/model";
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
  const { t, formatNumber } = useI18n();
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
  const { c, l } = useLivingPresentation();
  const [preview] = useState(previewReadings), [kind, setKind] = useState<Kind>("pressure");
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
  return <PublicLayout>
    <main id="public-content" className="living-auth route-content" tabIndex={-1}>
    <aside className="living-auth-story" aria-labelledby="auth-story-title">
      <SignatureArtwork />
      <span className="eyebrow"><span className="tiny-line" />{t("public.living.heroLabel")}</span>
      <h2 id="auth-story-title">{t("public.living.heroTitle")} <span>{t("public.living.heroAccent")}</span></h2>
      <p>{t("public.living.productSummary")}</p>
      <div className="auth-story-preview"><HealthCanvas c={c} l={l} readings={preview} kind={kind} onKind={setKind} compact /></div>
      <ol className="auth-journey">
        {(["One", "Two", "Three"] as const).map((step, index) => <li key={step}><span aria-hidden="true">{formatNumber(index + 1, { minimumIntegerDigits: 2 })}</span><div><h3>{t(`public.next.step${step}`)}</h3><p>{t(`public.next.step${step}Body`)}</p></div></li>)}
      </ol>
    </aside>
    <section className="auth-card glass" aria-labelledby="auth-title">
      <LivingPulse cue={mode} /><span className="eyebrow"><ShieldCheck size={18} aria-hidden="true" />{t(register ? "public.patientOnly" : "public.authEyebrow")}</span>
      <h1 id="auth-title">{t(register ? "auth.register" : "auth.signIn")}</h1>
      <p className="muted">{t(register ? "auth.registerIntro" : "auth.loginIntro")}</p>
      {auth.expired && <Feedback>{t("auth.expired")}</Feedback>}
      {!register && params.get("registered") === "1" && <Feedback kind="success">{t("auth.created")}</Feedback>}
      <form onSubmit={submit} noValidate aria-busy={busy}>
        <fieldset disabled={busy}>
          {register && <Input label={t("auth.name")} value={name} onChange={e => setName(e.target.value)} autoComplete="name" maxLength={100} required error={fields.name && t(fields.name)} />}
          <Input label={t("auth.email")} type="email" dir="ltr" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" maxLength={254} required error={fields.email && t(fields.email)} />
          <div className="password-field">
            <Input id="auth-password" label={t("auth.password")} type={show ? "text" : "password"} dir="ltr" value={password} onChange={e => setPassword(e.target.value)} autoComplete={register ? "new-password" : "current-password"} minLength={12} maxLength={128} required error={fields.password && t(fields.password)} aria-describedby={`password-hint${fields.password ? " auth-password-error" : ""}`} />
            <button className="password-toggle" type="button" aria-controls="auth-password" aria-label={t(show ? "auth.hidePassword" : "auth.showPassword")} title={t(show ? "auth.hidePassword" : "auth.showPassword")} aria-pressed={show} onClick={() => setShow(!show)}>{show ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}</button>
          </div>
          <small className="muted password-hint" id="password-hint">{t("auth.passwordHint")}</small>
          {register && <Input label={t("auth.confirmation")} type={show ? "text" : "password"} dir="ltr" value={confirmation} onChange={e => setConfirmation(e.target.value)} autoComplete="new-password" maxLength={128} required error={fields.confirmation && t(fields.confirmation)} />}
          {error && <Feedback kind="error">{t(error)}</Feedback>}
          <Button type="submit" loading={busy}>{t(busy ? "auth.working" : register ? "auth.register" : "auth.signIn")}</Button>
        </fieldset>
      </form>
      <p className="auth-switch"><Link to={`${register ? "/login" : "/register"}${suffix}`}>{t(register ? "auth.haveAccount" : "auth.needAccount")}</Link></p>
      <p className="auth-security"><ShieldCheck size={18} aria-hidden="true" />{t("auth.memoryNotice")}</p>
      <div className="auth-demo-intro"><h2>{t("public.demoHeading")}</h2><p>{t("public.demoBody")}</p></div>
      <Button variant="secondary" disabled={busy} onClick={async () => {
        setBusy(true); setError(null);
        try { await auth.enterDemo(); navigate("/patient/dashboard"); }
        catch { setError("auth.network"); } finally { setBusy(false); }
      }}>{t("auth.exploreDemo")}</Button>
      <p className="auth-data-note">{t("auth.dataNotice")}</p>
      <Link className="auth-home-link" to="/"><ArrowRight size={17} aria-hidden="true" />{t("auth.backHome")}</Link>
    </section>
    </main>
  </PublicLayout>;
}
