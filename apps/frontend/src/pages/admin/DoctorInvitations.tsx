import {useQuery} from "@tanstack/react-query";
import {Mail,ChevronDown,RefreshCw,UserPlus} from "lucide-react";
import {useAuth} from "@/auth/context";
import {getAdminInvitations} from "@/lib/api/admin";
import {useI18n} from "@/i18n/context";
import {Button} from "@/components/ui/Button";
import {Feedback} from "@/components/ui/Feedback";

export function DoctorInvitations({onCreate}:{onCreate:()=>void}){
 const {request,user}=useAuth();const {t,formatDateTime}=useI18n();
 const query=useQuery({queryKey:["admin-invitations",user?.id],enabled:user?.role==="admin",queryFn:({signal})=>getAdminInvitations(request,signal),staleTime:0,refetchInterval:15000});
 const accountLabels={active:"graduation.active",disabled:"graduation.disabled","password-change":"graduation.passwordChange","not-created":"graduation.notCreated"} as const;
 return <section className="admin-invitations" aria-labelledby="admin-invitations-title"><header className="admin-section-heading"><Mail size={22} aria-hidden="true" /><div><h2 id="admin-invitations-title" tabIndex={-1}>{t("graduation.invitations")}</h2><p>{t("graduation.invitationsHint")}</p></div><Button variant="ghost" onClick={()=>void query.refetch()} aria-label={t("common.actions.retry")}><RefreshCw size={18} aria-hidden="true" /></Button></header>
 {query.isPending?<Feedback kind="loading">{t("admin.loading")}</Feedback>:query.isError?<Feedback kind="error" action={<Button variant="secondary" onClick={()=>void query.refetch()}>{t("common.actions.retry")}</Button>}>{t("graduation.loadFailed")}</Feedback>:query.data?.length?<ul className="invitation-ledger">{query.data.map(item=><li key={item.email+item.issuedAt}><details><summary><span className="invitation-recipient"><strong><bdi>{item.name}</bdi></strong><bdi dir="ltr">{item.email}</bdi></span><span className="invitation-issued"><small>{t("graduation.issued")}</small><time dateTime={item.issuedAt}>{formatDateTime(item.issuedAt)}</time></span><span className="invitation-status">{t(`graduation.${item.status}`)}</span><ChevronDown size={18} aria-hidden="true" /></summary><div className="invitation-ledger-detail"><dl><div><dt>{t("graduation.accountStatus")}</dt><dd>{t(accountLabels[item.accountStatus])}</dd></div><div><dt>{t("graduation.delivery")}</dt><dd>{t(item.delivered?"graduation.delivered":"graduation.undelivered")}</dd></div><div><dt>{t("graduation.expires")}</dt><dd><time dateTime={item.expiresAt}>{formatDateTime(item.expiresAt)}</time></dd></div>{item.consumedAt&&<div><dt>{t("graduation.closedAt")}</dt><dd><time dateTime={item.consumedAt}>{formatDateTime(item.consumedAt)}</time></dd></div>}</dl>{item.status==="closed"&&<p>{t("graduation.closedHint")}</p>}</div></details></li>)}</ul>:<div className="invitation-empty"><Mail size={48} strokeWidth={1.5} aria-hidden="true" /><p>{t("graduation.noInvitations")}</p><Button variant="secondary" onClick={onCreate}><UserPlus size={18} aria-hidden="true" />{t("admin.createTitle")}</Button></div>}
 <p className="admin-event-source">{t("graduation.adminSource")}</p></section>;
}
