import { Router } from "express";
import { requireAuth, requireRoles, type AuthLocals } from "../auth/middleware.js";
import type { AuthStore } from "../auth/store.js";
import type { MedicationStore } from "../medications/store.js";
import { medicationDate, medicationId, medicationTime, validateDoseAction, validateMedication } from "../medications/validation.js";
import { HttpError } from "../middleware/errors.js";

const missing = () => new HttpError(404, "MEDICATION_NOT_FOUND", "Medication or schedule not found.");
function day(value: unknown) {
  if (Array.isArray(value)) throw new HttpError(400, "INVALID_MEDICATION_DATE", "Medication date is invalid.");
  return medicationDate(value);
}
export function medicationRoutes(auth: AuthStore, store: MedicationStore) {
  const router = Router();
  router.use(requireAuth(auth), requireRoles("patient"));
  router.get("/", async (request, response) => {
    response.json({ medications: await store.list((response.locals as AuthLocals).user.id, day(request.query.date)) });
  });
  router.get("/:id", async (request, response) => {
    const result = await store.get((response.locals as AuthLocals).user.id, medicationId(request.params.id), day(request.query.date));
    if (!result) throw missing();
    response.json({ medication: result });
  });
  router.post("/", async (request, response) => {
    const result = await store.create((response.locals as AuthLocals).user.id, validateMedication(request.body), day(request.query.date));
    response.status(201).location(`/api/medications/${result.id}`).json({ medication: result });
  });
  router.put("/:id", async (request, response) => {
    const result = await store.update((response.locals as AuthLocals).user.id, medicationId(request.params.id), validateMedication(request.body), day(request.query.date));
    if (!result) throw missing();
    response.json({ medication: result });
  });
  router.delete("/:id", async (request, response) => {
    if (!await store.delete((response.locals as AuthLocals).user.id, medicationId(request.params.id))) throw missing();
    response.status(204).end();
  });
  router.put("/:id/doses/:time", async (request, response) => {
    if (!await store.setDose((response.locals as AuthLocals).user.id, medicationId(request.params.id), medicationTime(request.params.time), validateDoseAction(request.body))) throw missing();
    response.status(204).end();
  });
  return router;
}
