import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import type { AccountService } from "../auth/accounts.js";
export function accountRoutes(service: AccountService) {
  const router = Router();
  router.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false,
    message: { error: { code: "RATE_LIMITED", message: "Too many attempts." } } }));
  router.post("/forgot-password", async (request, response) => { await service.forgot(request.body); response.status(202).json({ accepted: true }); });
  router.post("/activate-admin", async (request, response) => { await service.redeem("admin_activation", request.body); response.status(204).end(); });
  router.post("/reset-password", async (request, response) => { await service.redeem("password_reset", request.body); response.status(204).end(); });
  return router;
}
