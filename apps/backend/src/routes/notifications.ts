import { Router } from "express";
import { requireAuth, type AuthLocals } from "../auth/middleware.js";
import type { AuthStore } from "../auth/store.js";
import type { NotificationStore } from "../notifications/store.js";
import { HttpError } from "../middleware/errors.js";
export function notificationRoutes(auth: AuthStore, store: NotificationStore) {
  const router = Router();
  router.use(requireAuth(auth));
  router.get("/", async (request, response) => {
    if (Object.keys(request.query).length) throw new HttpError(400, "INVALID_INPUT", "Query fields are not supported.");
    response.json({ notifications: await store.list((response.locals as AuthLocals).user.id) });
  });
  router.get("/unread-count", async (request, response) => {
    if (Object.keys(request.query).length) throw new HttpError(400, "INVALID_INPUT", "Query fields are not supported.");
    response.json({ unreadCount: await store.unreadCount((response.locals as AuthLocals).user.id) });
  });
  router.put("/:id/read", async (request, response) => {
    const id = request.params.id;
    if (typeof id !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id) ||
        Object.keys(request.query).length || (request.body !== undefined && (!request.body || typeof request.body !== "object" || Array.isArray(request.body) || Object.keys(request.body).length))) {
      throw new HttpError(400, "INVALID_INPUT", "Provide only a valid notification identifier.");
    }
    const notification = await store.read((response.locals as AuthLocals).user.id, id);
    if (!notification) throw new HttpError(404, "NOTIFICATION_NOT_FOUND", "Notification not found.");
    response.json({ notification });
  });
  return router;
}
