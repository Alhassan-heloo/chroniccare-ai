import { Router } from "express";
import { healthRoutes } from "./health.js";

export function apiRoutes(checkDatabase: () => Promise<void>) {
  const router = Router();
  router.use("/health", healthRoutes(checkDatabase));
  // Future features must add authentication and authorization before data routes.
  return router;
}
