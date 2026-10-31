import { Router } from "express";
import { requireAuth, requireRoles, type AuthLocals } from "../auth/middleware.js";
import type { AuthStore } from "../auth/store.js";
import type { HabitStore } from "../habits/store.js";
import { habitDate, habitId, validateHabit, validateProgress } from "../habits/validation.js";
import { HttpError } from "../middleware/errors.js";

const missing = () => new HttpError(404, "HABIT_NOT_FOUND", "Habit not found.");
function day(value: unknown) {
  if (Array.isArray(value)) throw new HttpError(400, "INVALID_HABIT_DATE", "Habit date is invalid.");
  return habitDate(value);
}
export function habitRoutes(auth: AuthStore, store: HabitStore) {
  const router = Router();
  router.use(requireAuth(auth), requireRoles("patient"));
  router.get("/", async (request, response) => {
    response.json({ habits: await store.list((response.locals as AuthLocals).user.id, day(request.query.date)) });
  });
  router.get("/:id", async (request, response) => {
    const result = await store.get((response.locals as AuthLocals).user.id, habitId(request.params.id), day(request.query.date));
    if (!result) throw missing();
    response.json({ habit: result });
  });
  router.post("/", async (request, response) => {
    const result = await store.create((response.locals as AuthLocals).user.id, validateHabit(request.body), day(request.query.date));
    response.status(201).location("/api/habits/" + result.id).json({ habit: result });
  });
  router.put("/:id", async (request, response) => {
    const result = await store.update((response.locals as AuthLocals).user.id, habitId(request.params.id), validateHabit(request.body), day(request.query.date));
    if (!result) throw missing();
    response.json({ habit: result });
  });
  router.delete("/:id", async (request, response) => {
    if (!await store.delete((response.locals as AuthLocals).user.id, habitId(request.params.id))) throw missing();
    response.status(204).end();
  });
  router.put("/:id/progress", async (request, response) => {
    if (!await store.setProgress((response.locals as AuthLocals).user.id, habitId(request.params.id), validateProgress(request.body))) throw missing();
    response.status(204).end();
  });
  return router;
}
