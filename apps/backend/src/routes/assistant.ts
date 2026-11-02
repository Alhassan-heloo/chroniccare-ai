import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import type { AuthStore } from "../auth/store.js";
import { requireAuth, requireRoles, type AuthLocals } from "../auth/middleware.js";
import type { AssistantProvider } from "../assistant/provider.js";
import { assistantMessage, assistantSafety } from "../assistant/validation.js";
import { HttpError } from "../middleware/errors.js";

export function assistantRoutes(auth: AuthStore, provider?: AssistantProvider) {
  const router = Router();
  const message = { error: { code: "ASSISTANT_RATE_LIMITED", message: "Assistant request limit reached. Try again later." } };
  router.use(requireAuth(auth), requireRoles("patient"));
  router.use(rateLimit({ windowMs: 60000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false, message }));
  const patientKey = (_request: unknown, response: { locals: unknown }) => (response.locals as AuthLocals).user.id;
  router.use(rateLimit({ windowMs: 60000, limit: 5, keyGenerator: patientKey, standardHeaders: "draft-8", legacyHeaders: false, message }));
  router.use(rateLimit({ windowMs: 86400000, limit: 30, keyGenerator: patientKey, standardHeaders: "draft-8", legacyHeaders: false, message }));
  const budget = rateLimit({ windowMs: 86400000, limit: 200, keyGenerator: () => "assistant-budget", standardHeaders: "draft-8", legacyHeaders: false, message });
  const active = new Set<string>();
  router.post("/messages", (request, _response, next) => { assistantMessage(request.body); next(); },
    (_request, _response, next) => { if (!provider) throw new HttpError(503, "ASSISTANT_NOT_CONFIGURED", "The assistant is not configured."); next(); }, budget,
    async (request, response) => {
      const input = assistantMessage(request.body);
      const patientId = (response.locals as AuthLocals).user.id;
      if (active.has(patientId) || active.size >= 4) throw new HttpError(429, "ASSISTANT_BUSY", "An assistant request is already running. Try again later.");
      active.add(patientId);
      const controller = new AbortController();
      const closed = () => { if (!response.writableEnded) controller.abort(); };
      response.once("close", closed);
      try {
        const reply = await provider!.reply(input, controller.signal);
        if (!controller.signal.aborted) response.json({ data: { reply, language: input.language, ...assistantSafety[input.language] } });
      } finally { active.delete(patientId); response.off("close", closed); }
    });
  return router;
}
