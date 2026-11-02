import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/queryKeys";
import { Bell } from "lucide-react";
import { useAuth } from "@/auth/context";
import { useI18n } from "@/i18n/context";
import { useNotifications } from "@/hooks/queries/useNotifications";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Feedback } from "@/components/ui/Feedback";
import "@/styles/notifications.css";
import { BrowserNotificationControl } from "./BrowserNotificationControl";
export function NotificationCenter() {
  const { user } = useAuth();
  return user ? <AccountNotifications key={user.id} /> : null;
}
function AccountNotifications() {
  const [open, setOpen] = useState(false);
  const { t, formatNumber, formatDateTime } = useI18n();
  const { count, list, read } = useNotifications(open);
  const client=useQueryClient();
  useEffect(()=>{
    if (!("serviceWorker" in navigator)) return;
    const refresh=(event:MessageEvent)=>{ if (event.data?.type==="cc-push-refresh") void client.invalidateQueries({queryKey:queryKeys.notifications}); };
    navigator.serviceWorker.addEventListener("message",refresh);
    return ()=>navigator.serviceWorker.removeEventListener("message",refresh);
  },[client]);
  return <>
    <Button className="notification-bell" variant="ghost" aria-label={`${t("common.layout.showNotifications")}${!count.isError && count.data !== undefined ? ": " + t("notificationsUi.unreadCount", { count: formatNumber(count.data) }) : ""}`} aria-haspopup="dialog" aria-expanded={open}
      onClick={() => setOpen(true)}><Bell size={21} aria-hidden="true" />
      {!count.isError && typeof count.data === "number" && count.data > 0 && <span className="notification-badge" aria-hidden="true">{count.data > 99 ? "99+" : formatNumber(count.data)}</span>}
      <span className="sr-only">{count.isError ? t("notificationsUi.countError") : count.data !== undefined ? t("notificationsUi.unreadCount", { count: formatNumber(count.data) }) : t("notificationsUi.loading")}</span>
    </Button>
    <Modal open={open} onClose={() => setOpen(false)} title={t("common.layout.notifications")} declarativeTitle>
      {open && <div className="notification-center" data-i18n="declarative">
        <BrowserNotificationControl />
        <p className="muted">{t("notificationsUi.latest")}</p>
        {list.isPending ? <Feedback kind="loading">{t("notificationsUi.loading")}</Feedback>
          : list.isError ? <Feedback kind="error" action={<Button onClick={() => void list.refetch()}>{t("common.actions.retry")}</Button>}>{t("notificationsUi.failed")}</Feedback>
            : !list.data?.length ? <Feedback kind="empty">{t("notificationsUi.empty")}</Feedback>
              : <ul>{list.data.map(item => <li key={item.id} className={item.readAt ? "is-read" : "is-unread"}>
                <div><h3>{t(item.type === "connection_approved" ? "notificationsUi.approvedTitle" : "notificationsUi.revokedTitle")}</h3>
                  <p>{t(item.type === "connection_approved" ? "notificationsUi.approvedBody" : "notificationsUi.revokedBody")}</p>
                  <time dateTime={item.createdAt}>{formatDateTime(item.createdAt)}</time>
                </div>
                {item.readAt ? <small>{t("notificationsUi.read")}</small> : <Button variant="secondary" disabled={read.isPending} onClick={() => read.mutate(item.id)}>{t("notificationsUi.markRead")}</Button>}
              </li>)}</ul>}
        {read.isError && <Feedback kind="error">{t("notificationsUi.readFailed")}</Feedback>}
        {count.isError && <Feedback kind="error" action={<Button onClick={() => void count.refetch()}>{t("common.actions.retry")}</Button>}>{t("notificationsUi.countError")}</Feedback>}
      </div>}
    </Modal>
  </>;
}
