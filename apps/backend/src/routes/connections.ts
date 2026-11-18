import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { requireAuth, requireRoles, type AuthLocals } from "../auth/middleware.js";
import type { AuthStore } from "../auth/store.js";
import { connectionCode, invitationInput, type ConnectionStore } from "../connections/store.js";
import { doctorPatientId } from "../doctor/validation.js";

export function connectionRoutes(auth: AuthStore, store: ConnectionStore) {
  const router = Router();
  router.use(requireAuth(auth));
  const limit = () => rateLimit({ windowMs: 15 * 60 * 1000, limit: 20,
    standardHeaders: "draft-8", legacyHeaders: false,
    message: { error: { code: "RATE_LIMITED", message: "Too many connection attempts." } } });
  router.post("/invitations", requireRoles("doctor"), limit(), async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.status(201).json(await store.invite((response.locals as AuthLocals).user.id, invitationInput(request.body, "email")));
  });
  router.post("/invitations/preview", requireRoles("patient"), limit(), async (request, response) => {
    response.json({ doctor: await store.previewInvitation((response.locals as AuthLocals).user.id, invitationInput(request.body, "token")) });
  });
  router.post("/invitations/approve", requireRoles("patient"), limit(), async (request, response) => {
    await store.approveInvitation((response.locals as AuthLocals).user.id, invitationInput(request.body, "token"));
    response.status(204).end();
  });
  router.post("/codes", requireRoles("doctor"), limit(), async (_request, response) => {
    response.status(201).json(await store.generate((response.locals as AuthLocals).user.id));
  });
  router.post("/preview", requireRoles("patient"), limit(), async (request, response) => {
    response.json({ doctor: await store.preview(connectionCode(request.body)) });
  });
  router.post("/approve", requireRoles("patient"), limit(), async (request, response) => {
    await store.approve((response.locals as AuthLocals).user.id, connectionCode(request.body));
    response.status(204).end();
  });
  router.get("/doctors", requireRoles("patient"), async (_request, response) => {
    response.json({ doctors: await store.list((response.locals as AuthLocals).user.id) });
  });
  router.delete("/doctors/:doctorId", requireRoles("patient"), async (request, response) => {
    await store.revoke((response.locals as AuthLocals).user.id, doctorPatientId(typeof request.params.doctorId === "string" ? request.params.doctorId : ""));
    response.status(204).end();
  });
  return router;
}
