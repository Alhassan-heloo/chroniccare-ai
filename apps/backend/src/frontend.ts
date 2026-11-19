import { statSync } from "node:fs";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Router, static as serveStatic } from "express";
import helmet from "helmet";
import { HttpError, notFound } from "./middleware/errors.js";

// The same sibling path works from backend/src and compiled backend/dist.
export const frontendBuildDirectory = fileURLToPath(new URL("../../frontend/dist/", import.meta.url));

export function requireFrontendBuild(directory: string) {
  const root = resolve(directory), index = resolve(root, "index.html");
  try { if (!statSync(index).isFile()) throw new Error(); }
  catch { throw new Error("Built frontend index.html is missing. Build apps/frontend before starting production."); }
  return root;
}

export function frontendRoutes(directory: string) {
  const root = requireFrontendBuild(directory), index = resolve(root, "index.html");
  const router = Router();
  // API responses keep the original Helmet policy. Only the UI needs these
  // exact existing Firebase client endpoints; scripts still require 'self'.
  router.use(helmet.contentSecurityPolicy({ directives: { connectSrc: ["'self'",
    "https://firebaseinstallations.googleapis.com", "https://fcmregistrations.googleapis.com"] } }));
  router.use((request, response, next) => {
    let path: string;
    try { path = decodeURIComponent(request.path); }
    catch { return next(new HttpError(400, "INVALID_PATH", "Request path is invalid.")); }
    if (path.includes("\\") || path.includes("\0") || path.split("/").some(part => part.startsWith("."))
      || /^\/api(?:\/|$)/i.test(path)) {
      return notFound(request, response, next);
    }
    next();
  });
  router.use(serveStatic(root, { index: false, redirect: false, dotfiles: "ignore", cacheControl: false }));
  router.use((request, response, next) => {
    const path = decodeURIComponent(request.path);
    if (!["GET", "HEAD"].includes(request.method) || !request.accepts("html")
      || extname(path) || /^\/(?:assets|cc-fcm|fonts|images|src|node_modules|artifacts)(?:\/|$)/i.test(path)) {
      return next();
    }
    response.sendFile(index, { cacheControl: false });
  });
  return router;
}
