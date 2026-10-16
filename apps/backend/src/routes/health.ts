import { Router } from "express";

export function healthRoutes(checkDatabase: () => Promise<void>) {
  const router = Router();
  router.get("/", (_request, response) => {
    response.json({ status: "ok", service: "chroniccare-api" });
  });
  router.get("/ready", async (_request, response) => {
    try {
      await checkDatabase();
      response.json({ status: "ok", database: "up" });
    } catch {
      response.status(503).json({ status: "unavailable", database: "down" });
    }
  });
  return router;
}
