import { Link } from "react-router";
import { Compass } from "lucide-react";
import { PublicLayout } from "@/components/public/PublicLayout";
import { useI18n } from "@/i18n/context";
import { useAuth } from "@/auth/context";
import { roleHome } from "@/auth/api";

export default function UnavailablePage({ error = false }: { error?: boolean }) {
  const { t } = useI18n();
  const { user } = useAuth();
  return <PublicLayout><main id="public-content" tabIndex={-1} className="account-recovery route-content">
    <section className="auth-card glass"><Compass className="account-symbol" size={32} aria-hidden="true" />
      <h1>{t(error ? "experience.pageError" : "experience.notFound")}</h1><p className="muted">{t(error ? "experience.pageErrorBody" : "experience.notFoundBody")}</p>
      <Link className="btn btn-primary" to={user ? roleHome(user.role) : "/"}>{t(user ? `auth.${user.role}` : "experience.home")}</Link>
    </section>
  </main></PublicLayout>;
}
