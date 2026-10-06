export interface Notification {
  id: string;
  title: string;
  description: string;
  level: "info" | "warning" | "danger";
  read: boolean;
}
