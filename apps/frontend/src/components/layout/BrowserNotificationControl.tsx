import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/context";
import { useI18n } from "@/i18n/context";
import { Button } from "@/components/ui/Button";
import { Feedback } from "@/components/ui/Feedback";
import { browserAvailability, registerBrowser, unregisterBrowser } from "@/lib/notifications/browser";
export function BrowserNotificationControl() {
  const { request, user } = useAuth(), { t } = useI18n(), client = useQueryClient();
  const [issue, setIssue] = useState<ReturnType<typeof browserAvailability> | "failed">(null);
  const key = ["browser-registration", user?.id], path = "/notifications/browser-registration";
  const status = useQuery({ queryKey: key, queryFn: ({ signal }) => request<{ registered: boolean; context: string }>(path, { signal }), staleTime: 0 });
  const mutation = useMutation({ retry: 0, mutationFn: async (disable: boolean) => {
    setIssue(null);
    const context = status.data?.context;
    if (!context) throw new Error("status");
    if (disable) {
      // Server revocation comes first; Firebase cleanup failure cannot restore ownership.
      await request(path, { method: "DELETE", body: { context } });
      await client.invalidateQueries({ queryKey: key });
      await unregisterBrowser();
    } else {
      const unavailable = browserAvailability();
      if (unavailable) { setIssue(unavailable); return; }
      const fid = await registerBrowser();
      await request(path, { method: "PUT", body: { fid, context } });
      await client.invalidateQueries({ queryKey: key });
    }
  }, onError: () => setIssue(browserAvailability() ?? "failed") });
  const unavailable = browserAvailability();
  return <section aria-label={t("browserPush.title")} className="browser-notification-control">
    <h3>{t("browserPush.title")}</h3><p>{t("browserPush.intro")}</p>
    {status.isPending ? <Feedback kind="loading">{t("notificationsUi.loading")}</Feedback> : status.isError ?
      <Feedback kind="error" action={<Button onClick={() => void status.refetch()}>{t("common.actions.retry")}</Button>}>{t("browserPush.failed")}</Feedback> : <>
      <p role="status">{t(status.data?.registered ? "browserPush.enabled" : "browserPush.disabled")}</p>
      <Button variant="secondary" disabled={mutation.isPending || (!status.data?.registered && !!unavailable)} onClick={() => mutation.mutate(!!status.data?.registered)}>
        {t(mutation.isPending ? "browserPush.working" : status.data?.registered ? "browserPush.disable" : "browserPush.enable")}
      </Button>
    </>}
    {(issue || unavailable) && <p role="status">{t(`browserPush.${issue ?? unavailable ?? "failed"}`)}</p>}
  </section>;
}
