import type pg from "pg";
export interface Notification { id: string; type: "connection_approved" | "connection_revoked"; createdAt: string; readAt: string | null }
interface Row { id: string; type: Notification["type"]; created_at: Date; read_at: Date | null }
const notification = (row: Row): Notification => ({ id: row.id, type: row.type, createdAt: row.created_at.toISOString(), readAt: row.read_at?.toISOString() ?? null });
export function postgresNotificationStore(pool: Pick<pg.Pool, "query">) {
  return {
    async list(userId: string) {
      return (await pool.query<Row>(`SELECT id,type,created_at,read_at FROM chroniccare.notifications
        WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT 50`, [userId])).rows.map(notification);
    },
    async unreadCount(userId: string) {
      return (await pool.query<{ count: number }>("SELECT count(*)::int AS count FROM chroniccare.notifications WHERE user_id=$1 AND read_at IS NULL", [userId])).rows[0]!.count;
    },
    async read(userId: string, id: string) {
      const row = (await pool.query<Row>(`UPDATE chroniccare.notifications SET read_at=COALESCE(read_at,clock_timestamp())
        WHERE user_id=$1 AND id=$2 RETURNING id,type,created_at,read_at`, [userId, id])).rows[0];
      return row ? notification(row) : undefined;
    },
  };
}
export type NotificationStore = ReturnType<typeof postgresNotificationStore>;
