import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { useAuth, type AuthValue } from "@/auth/context";
import { AuthError } from "@/auth/api";
import { useI18n } from "@/i18n/context";
import { PublicLayout } from "@/components/public/PublicLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Feedback } from "@/components/ui/Feedback";
import { Modal } from "@/components/ui/Modal";
import "@/styles/evolution/clinical.css";

const invitationErrors = {
  INVITATION_INVALID: "finalExperience.invalidInvitation",
  INVITATION_USED: "finalExperience.usedInvitation",
  INVITATION_REJECTED: "finalExperience.rejectedInvitation",
  INVITATION_ACCOUNT_MISMATCH: "finalExperience.wrongAccount",
} as const;

export default function PatientInvitationPage() {
  const { hash } = useLocation();
  const auth = useAuth();
  const token = new URLSearchParams(hash.slice(1)).get("token") ?? "";
  return <InvitationReview key={`${auth.user?.id ?? "anonymous"}:${token}`} token={token} auth={auth} />;
}

function InvitationReview({ token, auth }: { token: string; auth: AuthValue }) {
  const { user, loading, request, logout } = auth;
  const { t } = useI18n();
  const valid = /^[A-Za-z0-9_-]{32}$/.test(token);
  const client = useQueryClient();
  const [closed, setClosed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const outcomeRef = useRef<HTMLDivElement>(null);
  const decision = useMutation({
    mutationFn: (action: "approve" | "reject") => request<void>(`/connections/invitations/${action}`, { body: { token } }),
    retry: false,
    onSuccess: (_data, action) => {
      if (action === "approve") void client.invalidateQueries({ queryKey: ["patient", "doctors", user?.id] });
    },
  });
  const preview = useQuery({
    queryKey: ["patient-invitation", user?.id, token],
    enabled: valid && user?.role === "patient" && !closed && !decision.isSuccess,
    queryFn: ({ signal }) => request<{ doctor: { id: string; name: string } }>("/connections/invitations/preview", { body: { token }, signal }),
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
  const signOut = useMutation({ mutationFn: logout, retry: false });
  const error = decision.error ?? preview.error;
  const code = error instanceof AuthError ? error.code : "";
  const errorKey = Object.hasOwn(invitationErrors, code) ? invitationErrors[code as keyof typeof invitationErrors] : undefined;
  const wrongAccount = Boolean(user && user.role !== "patient") || code === "INVITATION_ACCOUNT_MISMATCH";
  const retryRejection = confirming && decision.variables === "reject" && decision.isError && !errorKey;
  const showOutcome = closed || decision.isSuccess || Boolean(error && !retryRejection);
  const rejectDialogOpen = confirming && !showOutcome && !wrongAccount;

  useEffect(() => {
    if (showOutcome) outcomeRef.current?.focus();
  }, [showOutcome]);

  function dismissConfirmation() {
    setConfirming(false);
    if (retryRejection) decision.reset();
  }

  const closeReview = <Button variant="secondary" disabled={decision.isPending} onClick={() => setClosed(true)}>
    {t("finalExperience.closeReview")}
  </Button>;
  let content;
  if (loading) {
    content = <Feedback kind="loading">{t("auth.working")}</Feedback>;
  } else if (!valid) {
    content = <Feedback kind="error">{t("finalExperience.invalidInvitation")}</Feedback>;
  } else if (closed) {
    content = <>
      <Feedback>{t("finalExperience.reviewClosed")}</Feedback>
      <Link className="btn btn-secondary" to="/patient/dashboard">{t("common.workspace.patient")}</Link>
    </>;
  } else if (decision.isSuccess) {
    content = <>
      <Feedback kind="success">{t(decision.variables === "reject" ? "finalExperience.rejectedInvitation" : "finalExperience.approved")}</Feedback>
      <Link className="btn btn-primary" to="/patient/doctors">{t("connections.myDoctors")}</Link>
    </>;
  } else if (!user) {
    content = <>
      <Feedback>{t("finalExperience.signInReview")}</Feedback>
      <Link className="btn btn-primary invitation-sign-in" to={`/login?returnTo=${encodeURIComponent("/patient/invitation")}#token=${token}`}>{t("auth.signIn")}</Link>
      {closeReview}
    </>;
  } else if (wrongAccount) {
    content = <>
      <Feedback kind="error">{t("finalExperience.wrongAccount")}</Feedback>
      <Button variant="secondary" loading={signOut.isPending} onClick={() => signOut.mutate()}>{t("finalExperience.switchAccount")}</Button>
    </>;
  } else if (error && !retryRejection) {
    content = <>
      <Feedback kind="error">{t(errorKey ?? "connections.failed")}</Feedback>
      {!errorKey && <Button variant="secondary" onClick={() => { decision.reset(); void preview.refetch(); }}>{t("common.actions.retry")}</Button>}
      <Link className="btn btn-secondary" to="/patient/doctors">{t("connections.myDoctors")}</Link>
    </>;
  } else if (preview.isPending || !preview.data) {
    content = <Feedback kind="loading">{t("doctor.loading")}</Feedback>;
  } else {
    content = <section className="stack invitation-consent">
      <h2><bdi>{preview.data.doctor.name}</bdi></h2>
      <p>{t("finalExperience.consent")}</p>
      <div className="invitation-actions">
        <Button loading={decision.isPending && decision.variables === "approve"} disabled={decision.isPending} onClick={() => decision.mutate("approve")}>
          {t("finalExperience.allow")}
        </Button>
        {closeReview}
        <Button variant="danger" disabled={decision.isPending} onClick={() => setConfirming(true)}>{t("finalExperience.rejectInvitation")}</Button>
      </div>
    </section>;
  }

  return (
    <PublicLayout>
      <meta name="referrer" content="no-referrer" />
      <main id="public-content" className="invitation-review route-content" data-i18n="declarative">
        <Card className="stack invitation-review-card">
          <ShieldCheck size={30} aria-hidden="true" />
          <h1>{t("finalExperience.invitationTitle")}</h1>
          <p>{t("finalExperience.invitationIntro")}</p>
          {showOutcome ? <div className="stack" ref={outcomeRef} tabIndex={-1}>{content}</div> : content}
          {signOut.isError && <Feedback kind="error">{t("auth.logoutFailed")}</Feedback>}
          <Link className="invitation-manual-link" to="/patient/doctors">{t("finalExperience.manual")}</Link>
        </Card>
        <Modal open={rejectDialogOpen} title={t("finalExperience.rejectInvitation")} onClose={dismissConfirmation} dismissible={!decision.isPending} declarativeTitle>
          <div className="stack">
            <p>{t("finalExperience.rejectInvitationHint")}</p>
            {retryRejection && <Feedback kind="error">{t("finalExperience.rejectInvitationFailed")}</Feedback>}
            <div className="invitation-actions">
              <Button variant="secondary" disabled={decision.isPending} onClick={dismissConfirmation}>{t("finalExperience.keepReviewing")}</Button>
              <Button variant="danger" loading={decision.isPending} onClick={() => decision.mutate("reject")}>{t("finalExperience.rejectInvitation")}</Button>
            </div>
          </div>
        </Modal>
      </main>
    </PublicLayout>
  );
}
