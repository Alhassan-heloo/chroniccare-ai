import { Link } from "react-router";
import { ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "@/auth/context";
import { useI18n } from "@/i18n/context";
import { PageHeading } from "@/components/ui/PageHeading";
import { Card } from "@/components/ui/Card";
export { default as AssistantPage } from "./AssistantPage";
export function ProfilePage() {
  const { user } = useAuth();
  const { t } = useI18n();
  return <div className="account-page stack" data-i18n="declarative">
    <PageHeading title={t("common.navigation.profile")} description={t("experience.accountIntro")} />
    <div className="account-grid"><Card className="account-identity stack">
      <span className="account-symbol"><UserRound size={28} aria-hidden="true" /></span>
      <h2><bdi>{user?.name}</bdi></h2><span className="account-role">{t("experience.roles.patient")}</span>
      <dl><div><dt>{t("auth.name")}</dt><dd><bdi>{user?.name}</bdi></dd></div><div><dt>{t("auth.email")}</dt><dd><bdi>{user?.email}</bdi></dd></div></dl>
    </Card><Card className="stack account-guidance"><ShieldCheck size={25} aria-hidden="true" /><h2>{t("connections.myDoctors")}</h2><p>{t("experience.accountAccess")}</p><Link className="btn btn-secondary" to="/patient/doctors">{t("connections.myDoctors")}</Link></Card></div>
  </div>;
}
