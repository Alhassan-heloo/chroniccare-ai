import { timingSafeEqual } from "node:crypto";
import type pg from "pg";
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { HttpError } from "../middleware/errors.js";
import { credentials, hashPassword, newToken, tokenHash } from "./security.js";
import { postgresAuthStore } from "./store.js";

export function bootstrapService(pool: pg.Pool, secret: string) {
  const digest = Buffer.from(tokenHash(secret), "hex");
  const available = async () => !(await pool.query("SELECT 1 FROM chroniccare.users WHERE role='admin' LIMIT 1")).rowCount;
  return {
    available,
    async create(body: unknown) {
      if (!await available()) throw new HttpError(404, "SETUP_CLOSED", "Initial setup is closed.");
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "INVALID_INPUT", "Invalid setup input.");
      const { setupCode, ...account } = body as Record<string, unknown>;
      if (typeof setupCode !== "string" || setupCode.length > 512 ||
          !timingSafeEqual(digest, Buffer.from(tokenHash(setupCode), "hex"))) {
        throw new HttpError(403, "INVALID_SETUP_CODE", "Invalid setup code.");
      }
      const input = credentials(account, true);
      const passwordHash = await hashPassword(input.password);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        // Same lock as the trusted CLI provisioner: both paths serialize together.
        await client.query("SELECT pg_advisory_xact_lock(20261015, 2)");
        if ((await client.query("SELECT 1 FROM chroniccare.users WHERE role='admin' LIMIT 1")).rowCount) {
          throw new HttpError(404, "SETUP_CLOSED", "Initial setup is closed.");
        }
        const user = await postgresAuthStore(client).createUser(input.name, input.email, passwordHash, "admin");
        await client.query("COMMIT");
        return user;
      } catch (error) {
        await client.query("ROLLBACK");
        if (error && typeof error === "object" && "code" in error && error.code === "23505") {
          throw new HttpError(409, "ACCOUNT_EXISTS", "An account with this email already exists.");
        }
        throw error;
      } finally { client.release(); }
    },
  };
}

export async function initializeBootstrap(pool: pg.Pool, nodeEnv: string, configuredSecret?: string) {
  if ((await pool.query("SELECT 1 FROM chroniccare.users WHERE role='admin' LIMIT 1")).rowCount) return undefined;
  if (nodeEnv === "production" && (!configuredSecret || configuredSecret.length < 32 || configuredSecret.length > 512)) {
    throw new Error("Production initial setup requires a trusted BOOTSTRAP_SECRET of 32–512 characters.");
  }
  const secret = configuredSecret || newToken();
  if (secret.length < 32 || secret.length > 512) throw new Error("Invalid bootstrap secret length.");
  if (nodeEnv === "development") console.log(`Initial Admin setup code (local operator only): ${secret}`);
  return bootstrapService(pool, secret);
}

export function bootstrapRoutes(service?: ReturnType<typeof bootstrapService>) {
  const router = Router();
  router.get("/", async (_request, response) => { response.json({ available: service ? await service.available() : false }); });
  router.post("/", rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, skipSuccessfulRequests: true,
    standardHeaders: "draft-8", legacyHeaders: false,
    message: { error: { code: "RATE_LIMITED", message: "Too many setup attempts." } } }), async (request, response) => {
    if (!service) throw new HttpError(404, "SETUP_CLOSED", "Initial setup is closed.");
    response.status(201).json({ user: await service.create(request.body) });
  });
  return router;
}
