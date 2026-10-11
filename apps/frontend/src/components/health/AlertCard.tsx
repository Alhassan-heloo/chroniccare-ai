import { Droplet } from "lucide-react";
import type { Notification } from "@/lib/types/notification";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n/context";
export function AlertCard({
  notification,
  onAction,
}: {
  notification: Notification;
  onAction: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="task-row">
      <span className={`icon-tile tone-${notification.level}`}>
        <Droplet />
      </span>
      <div className="task-copy">
        <h3 data-i18n={notification.id === "glucose-reminder" ? "declarative" : undefined}>{notification.id === "glucose-reminder" ? t("common.reminder.glucose") : notification.title}</h3>
        <p data-i18n={notification.id === "glucose-reminder" ? "declarative" : undefined}>{notification.id === "glucose-reminder" ? t("common.reminder.evening") : notification.description}</p>
      </div>
      <Button variant="ghost" onClick={onAction} data-i18n="declarative">
        {t("measurements.add")}
      </Button>
    </div>
  );
}
