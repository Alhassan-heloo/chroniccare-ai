import { Router } from "express";
import type { AdminStore } from "../admin/store.js";
import { requireAuth, requireRoles } from "../auth/middleware.js";
import { credentials, hashPassword } from "../auth/security.js";
import type { AuthStore } from "../auth/store.js";
import { HttpError } from "../middleware/errors.js";

function duplicateAccount(error: unknown) {
  return !!error && typeof error === "object" && "code" in error && error.code === "23505";
}

export function adminRoutes(auth: AuthStore, admin: AdminStore) {
  const router = Router();
  router.use(requireAuth(auth), requireRoles("admin"));
  router.get("/doctors", async (_request, response) => {
    response.json({ doctors: await admin.listDoctors() });
  });
  router.post("/doctors", async (request, response) => {
    const { name, email, password } = credentials(request.body, true);
    const passwordHash = await hashPassword(password);
    try {
      const doctor = await admin.createDoctor(name, email, passwordHash);
      response.status(201).json({ doctor });
    } catch (error) {
      if (duplicateAccount(error)) throw new HttpError(409, "ACCOUNT_EXISTS", "An account with this email already exists.");
      throw error;
    }
  });
  return router;
}
