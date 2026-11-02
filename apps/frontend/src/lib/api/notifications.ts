import { AuthError, type AuthorizedRequest } from "@/auth/api";
import type { AccountNotification } from "@/lib/types/notification";
function parse(value: unknown): AccountNotification {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AuthError("INVALID_RESPONSE");
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some(key => !["id", "type", "createdAt", "readAt"].includes(key)) ||
      typeof data.id !== "string" || !data.id || (data.type !== "connection_approved" && data.type !== "connection_revoked") ||
      typeof data.createdAt !== "string" || !Number.isFinite(Date.parse(data.createdAt)) ||
      !(data.readAt === null || (typeof data.readAt === "string" && Number.isFinite(Date.parse(data.readAt))))) throw new AuthError("INVALID_RESPONSE");
  return data as unknown as AccountNotification;
}
export async function getNotifications(request: AuthorizedRequest, signal?: AbortSignal) {
  const data = await request<{ notifications: unknown[] }>("/notifications", { signal });
  if (!data || !Array.isArray(data.notifications)) throw new AuthError("INVALID_RESPONSE");
  return data.notifications.map(parse);
}
export async function getUnreadCount(request: AuthorizedRequest, signal?: AbortSignal) {
  const data = await request<{ unreadCount: number }>("/notifications/unread-count", { signal });
  if (!data || !Number.isSafeInteger(data.unreadCount) || data.unreadCount < 0) throw new AuthError("INVALID_RESPONSE");
  return data.unreadCount;
}
export async function markNotificationRead(request: AuthorizedRequest, id: string) {
  const data = await request<{ notification: unknown }>(`/notifications/${encodeURIComponent(id)}/read`, { method: "PUT" });
  const notification = parse(data?.notification);
  if (notification.id !== id || !notification.readAt) throw new AuthError("INVALID_RESPONSE");
  return notification;
}
