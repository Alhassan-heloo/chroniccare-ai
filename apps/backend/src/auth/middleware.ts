import type { RequestHandler } from "express";
import { HttpError } from "../middleware/errors.js";
import { tokenHash } from "./security.js";
import type { AuthStore, Role, User } from "./store.js";
import { cookie, cookieName } from "./cookies.js";

export interface AuthLocals { user: User; sessionHash: string }

export function requireAuth(store: AuthStore): RequestHandler {
  return async (request, response, next) => {
    const sessionCookie = cookie(request, cookieName(response.locals.secureCookies === true));
    const header = request.get("Authorization") ?? "";
    const token = sessionCookie ?? (!request.get("Origin") && /^Bearer [a-f0-9]{64}$/.test(header) ? header.slice(7) : undefined);
    if (!token) throw new HttpError(401, "UNAUTHENTICATED", "Authentication is required.");
    const hash = tokenHash(token);
    const user = await store.sessionUser(hash);
    if (!user) throw new HttpError(401, "UNAUTHENTICATED", "Authentication is required.");
    response.locals.user = user;
    response.setHeader("X-Account-ID", user.id);
    response.locals.sessionHash = hash;
    next();
  };
}

// Always run requireAuth first. No role hierarchy: explicitly allow each required role.
export function requireRoles(...roles: Role[]): RequestHandler {
  return (_request, response, next) => {
    const user = response.locals.user as User | undefined;
    if (!user) throw new HttpError(401, "UNAUTHENTICATED", "Authentication is required.");
    if (!roles.includes(user.role)) throw new HttpError(403, "FORBIDDEN", "This role is not permitted.");
    next();
  };
}
