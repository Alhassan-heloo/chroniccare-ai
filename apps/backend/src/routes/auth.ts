import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { HttpError } from "../middleware/errors.js";
import { requireAuth } from "../auth/middleware.js";
import { credentials, hashPassword, newToken, tokenHash, verifyPassword } from "../auth/security.js";
import type { AuthStore, User } from "../auth/store.js";

export function authRoutes(store: AuthStore) {
  const router = Router();
  // Per-process/IP baseline; use an edge/shared limit before multi-instance deployment.
  const limit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false,
    message: { error: { code: "RATE_LIMITED", message: "Too many attempts. Try again later." } } });
  // Lazy initialization avoids work at import time; equal password work for unknown accounts.
  let dummy: Promise<string> | undefined;
  router.post("/register", limit, async (request, response) => {
    const { name, email, password } = credentials(request.body, true);
    const hash = await hashPassword(password);
    try {
      const user = await store.createUser(name, email, hash, "patient");
      response.status(201).json({ user });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "23505") {
        throw new HttpError(409, "ACCOUNT_EXISTS", "An account with this email already exists.");
      }
      throw error;
    }
  });
  router.post("/login", limit, async (request, response) => {
    const { email, password } = credentials(request.body);
    const account = await store.findAccount(email);
    dummy ??= hashPassword(newToken());
    const valid = await verifyPassword(account?.password_hash ?? await dummy, password);
    if (!account || !valid) throw new HttpError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
    const token = newToken();
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    await store.createSession(tokenHash(token), account.id, expiresAt);
    const user: User = { id: account.id, name: account.name, email: account.email, role: account.role };
    response.json({ user, token, expiresAt: expiresAt.toISOString() });
  });
  router.get("/me", requireAuth(store), (_request, response) => { response.json({ user: response.locals.user }); });
  router.post("/logout", requireAuth(store), async (_request, response) => {
    await store.deleteSession(response.locals.sessionHash as string);
    response.status(204).end();
  });
  return router;
}
