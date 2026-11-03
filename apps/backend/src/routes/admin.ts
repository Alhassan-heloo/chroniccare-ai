import { Router } from "express";
import type { AdminStore } from "../admin/store.js";
import { requireAuth, requireRoles } from "../auth/middleware.js";
import type { AuthStore } from "../auth/store.js";
import { HttpError } from "../middleware/errors.js";
import type { AccountService } from "../auth/accounts.js";

export function adminRoutes(auth: AuthStore, admin: AdminStore, accounts?: AccountService) {
  const router = Router();
  router.use(requireAuth(auth), requireRoles("admin"));
  router.get("/doctors", async (_request, response) => {
    response.json({ doctors: await admin.listDoctors() });
  });
  router.post("/doctors", async (request, response) => {
    if (!accounts) throw new HttpError(503, "EMAIL_UNAVAILABLE", "Email delivery is not configured.");
    response.status(201).json({ invitation: await accounts.inviteDoctor(request.body) });
  });
  return router;
}
