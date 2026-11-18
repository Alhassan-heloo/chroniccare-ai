import { useState } from "react";
import { Link, useLocation } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/auth/context";
import { AuthError } from "@/auth/api";
import { useI18n } from "@/i18n/context";
import { PublicLayout } from "@/components/public/PublicLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Feedback } from "@/components/ui/Feedback";
import "@/styles/evolution/clinical.css";

export default function PatientInvitationPage() {
  const { hash } = useLocation();
  const token = new URLSearchParams(hash.slice(1)).get("token") ?? "";
  return <InvitationReview key={token} token={token} />;
}

function InvitationReview({ token }: { token: string }) {
  const { user, loading, request, logout } = useAuth();
  const { t } = useI18n();
  const valid = /^[A-Za-z0-9_-]{32}$/.test(token);
  const client = useQueryClient();
  const [cancelled, setCancelled] = useState(false);
  const [approvedFor, setApprovedFor] = useState<string | null>(null);
  const preview = useQuery({ queryKey: ["patient-invitation", user?.id, token],
    enabled: valid && user?.role === "patient" && !cancelled && approvedFor !== user?.id,
    queryFn: ({ signal }) => request<{doctor:{id:string;name:string}}>("/connections/invitations/preview", {body:{token},signal}),
    retry: false, staleTime: 0, gcTime: 0,
  });
  const approve = useMutation({ mutationFn: () => request<void>("/connections/invitations/approve", {body:{token}}), retry: false,
    onSuccess: async () => { setApprovedFor(user!.id); await client.invalidateQueries({queryKey:["patient","doctors",user!.id]}); },
  });
  const signOut = useMutation({mutationFn:logout,retry:false});
  const error = approve.error ?? preview.error;
  const code = error instanceof AuthError ? error.code : "";
  const wrongAccount = Boolean(user && user.role !== "patient") || code === "INVITATION_ACCOUNT_MISMATCH";
  const accepted = Boolean(user && approvedFor === user.id);
  return <PublicLayout><meta name="referrer" content="no-referrer" /><main id="public-content" className="invitation-review route-content" data-i18n="declarative">
    <Card className="stack invitation-review-card"><ShieldCheck size={30} aria-hidden="true" /><h1>{t("finalExperience.invitationTitle")}</h1><p>{t("finalExperience.invitationIntro")}</p>
      {loading ? <Feedback kind="loading">{t("auth.working")}</Feedback> : !valid ? <Feedback kind="error">{t("finalExperience.invalidInvitation")}</Feedback>
        : cancelled ? <><Feedback>{t("finalExperience.cancelled")}</Feedback><Link className="btn btn-secondary" to="/patient/dashboard">{t("common.workspace.patient")}</Link></>
        : accepted ? <><Feedback kind="success">{t("finalExperience.approved")}</Feedback><Link className="btn btn-primary" to="/patient/doctors">{t("connections.myDoctors")}</Link></>
        : !user ? <><Feedback>{t("finalExperience.signInReview")}</Feedback><Link className="btn btn-primary invitation-sign-in" to={`/login?returnTo=${encodeURIComponent("/patient/invitation")}#token=${token}`}>{t("auth.signIn")}</Link><Button variant="secondary" onClick={()=>setCancelled(true)}>{t("connections.cancel")}</Button></>
        : wrongAccount ? <><Feedback kind="error">{t("finalExperience.wrongAccount")}</Feedback><Button variant="secondary" loading={signOut.isPending} onClick={()=>signOut.mutate()}>{t("finalExperience.switchAccount")}</Button></>
        : error ? <><Feedback kind="error">{t(code === "INVITATION_USED" ? "finalExperience.usedInvitation" : code === "INVITATION_INVALID" ? "finalExperience.invalidInvitation" : "connections.failed")}</Feedback>{!["INVITATION_USED","INVITATION_INVALID"].includes(code) && <Button variant="secondary" onClick={()=>{approve.reset();void preview.refetch();}}>{t("common.actions.retry")}</Button>}<Link className="btn btn-secondary" to="/patient/doctors">{t("connections.myDoctors")}</Link></>
        : preview.isPending || !preview.data ? <Feedback kind="loading">{t("doctor.loading")}</Feedback>
        : <section className="stack invitation-consent"><h2><bdi>{preview.data.doctor.name}</bdi></h2><p>{t("finalExperience.consent")}</p><div className="invitation-actions"><Button loading={approve.isPending} onClick={()=>{if(!approve.isPending)approve.mutate();}}>{t("finalExperience.allow")}</Button><Button variant="secondary" disabled={approve.isPending} onClick={()=>setCancelled(true)}>{t("connections.cancel")}</Button></div></section>}
      {signOut.isError && <Feedback kind="error">{t("auth.logoutFailed")}</Feedback>}
      <Link className="invitation-manual-link" to="/patient/doctors">{t("finalExperience.manual")}</Link>
    </Card>
  </main></PublicLayout>;
}
