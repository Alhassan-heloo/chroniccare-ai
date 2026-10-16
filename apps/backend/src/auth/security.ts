import { createHash, randomBytes } from "node:crypto";
import argon2 from "argon2";
import { HttpError } from "../middleware/errors.js";

export const hashPassword = (password: string): Promise<string> => argon2.hash(password, {
  type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1,
});
export const verifyPassword = (hash: string, password: string) => argon2.verify(hash, password);
export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(32).toString("hex");

export function credentials(body: unknown, register = false) {
  const invalid = () => new HttpError(400, "INVALID_INPUT", "Provide a valid email, password, and required account fields.");
  if (!body || typeof body !== "object" || Array.isArray(body)) throw invalid();
  const data = body as Record<string, unknown>;
  const allowed = register ? ["name", "email", "password"] : ["email", "password"];
  if (Object.keys(data).some((key) => !allowed.includes(key))) throw invalid();
  if (typeof data.email !== "string" || typeof data.password !== "string") throw invalid();
  const email = data.email.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      data.password.length < 12 || data.password.length > 128) throw invalid();
  const name = typeof data.name === "string" ? data.name.trim() : "";
  if (register && (!name || name.length > 100)) throw invalid();
  return { email, password: data.password, name };
}
