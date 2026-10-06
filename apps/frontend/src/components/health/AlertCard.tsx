import { Droplet } from "lucide-react";
import type { Notification } from "@/lib/types/notification";
import { Button } from "@/components/ui/Button";
export function AlertCard({
  notification,
  onAction,
}: {
  notification: Notification;
  onAction: () => void;
}) {
  return (
    <div className="task-row">
      <span className={`icon-tile tone-${notification.level}`}>
        <Droplet />
      </span>
      <div className="task-copy">
        <h3>{notification.title}</h3>
        <p>{notification.description}</p>
      </div>
      <Button variant="ghost" onClick={onAction}>
        إضافة قراءة
      </Button>
    </div>
  );
}
