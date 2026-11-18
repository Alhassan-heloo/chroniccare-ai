import { timingSafeEqual } from "node:crypto";
import type { Request, RequestHandler, Response } from "express";
import { HttpError } from "../middleware/errors.js";
import { newToken } from "./security.js";

export interface CookieSettings { secure: boolean; trustedProxy?: string | 1 }
export const cookieName = (secure: boolean, csrf = false) => `${secure ? "__Host-" : ""}cc_${csrf ? "csrf" : "session"}`;
export function cookie(request: Request, name: string) {
  const matches = (request.headers.cookie ?? "").split(";").map(part => part.trim()).filter(part => part.startsWith(name + "="));
  if (matches.length !== 1) return undefined;
  const value = matches[0]!.slice(name.length + 1);
  return /^[a-f0-9]{64}$/.test(value) ? value : undefined;
}
export function setSession(response: Response, token: string, secure: boolean, expires: Date) {
  response.cookie(cookieName(secure), token, { httpOnly: true, secure, sameSite: "lax", path: "/", expires });
}
export function clearSession(response: Response, secure: boolean) {
  response.clearCookie(cookieName(secure), { httpOnly: true, secure, sameSite: "lax", path: "/" });
}
export function issueCsrf(request: Request, response: Response, secure: boolean) {
  const token = cookie(request, cookieName(secure, true)) ?? newToken();
  response.cookie(cookieName(secure, true), token, { httpOnly: true, secure, sameSite: "lax", path: "/" });
  return token;
}
export function browserSecurity(origins: readonly string[], settings: CookieSettings): RequestHandler {
  return (request, response, next) => {
    response.locals.secureCookies = settings.secure;
    // Render probes this read-only endpoint over internal HTTP. No auth/cookies are issued.
    const readinessProbe = request.method === "GET" && request.path === "/api/health/ready";
    // A single trusted ingress must supply one protocol, not append a client-owned list.
    const ambiguousProtocol = settings.trustedProxy === 1 && request.get("X-Forwarded-Proto")?.includes(",");
    if (settings.secure && (!request.secure || ambiguousProtocol) && !readinessProbe) {
      throw new HttpError(400, "HTTPS_REQUIRED", "HTTPS is required.");
    }
    if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return next();
    const origin = request.get("Origin");
    // Non-browser Bearer clients have no ambient cookies. Browser writes always
    // require an explicitly trusted Origin plus a double-submit HttpOnly cookie.
    if (origin || request.headers.cookie || request.get("Sec-Fetch-Site")) {
      const expected = cookie(request, cookieName(settings.secure, true));
      const supplied = request.get("X-CSRF-Token");
      if (!origin || !origins.includes(origin) || !expected || !supplied ||
          !/^[a-f0-9]{64}$/.test(supplied) || !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) {
        throw new HttpError(403, "CSRF_INVALID", "Reload the page and try again.");
      }
    }
    next();
  };
}
