import { Router } from "express";
import { requireAuth, requireRoles, type AuthLocals } from "../auth/middleware.js";
import type { AuthStore } from "../auth/store.js";
import type { MeasurementStore } from "../measurements/store.js";
import { measurementId, validateMeasurement } from "../measurements/validation.js";
import { HttpError } from "../middleware/errors.js";

const missing = () => new HttpError(404, "MEASUREMENT_NOT_FOUND", "Measurement not found.");
export function measurementRoutes(auth: AuthStore, store: MeasurementStore) {
  const router = Router();
  router.use(requireAuth(auth), requireRoles("patient"));
  router.get("/", async (_request, response) => {
    response.json({ measurements: await store.list((response.locals as AuthLocals).user.id) });
  });
  router.get("/:id", async (request, response) => {
    const result = await store.get((response.locals as AuthLocals).user.id, measurementId(request.params.id));
    if (!result) throw missing();
    response.json({ measurement: result });
  });
  router.post("/", async (request, response) => {
    const result = await store.create((response.locals as AuthLocals).user.id, validateMeasurement(request.body, true));
    response.status(201).location(`/api/measurements/${result.id}`).json({ measurement: result });
  });
  router.put("/:id", async (request, response) => {
    const result = await store.update((response.locals as AuthLocals).user.id, measurementId(request.params.id), validateMeasurement(request.body).input);
    if (!result) throw missing();
    response.json({ measurement: result });
  });
  router.delete("/:id", async (request, response) => {
    if (!await store.delete((response.locals as AuthLocals).user.id, measurementId(request.params.id))) throw missing();
    response.status(204).end();
  });
  return router;
}
