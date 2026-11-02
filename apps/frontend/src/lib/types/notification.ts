export interface Notification {
  id: string;
  title: string;
  description: string;
  level: "info" | "warning" | "danger";
  read: boolean;
}

// Persistent account events; the older Notification shape is the legacy dashboard
// alert-card presentation model (its real-account placeholder is null).
export interface AccountNotification {
  id: string;
  type: "connection_approved" | "connection_revoked";
  createdAt: string;
  readAt: string | null;
}
