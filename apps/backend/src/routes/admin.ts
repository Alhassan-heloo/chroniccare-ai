import { rateLimit } from "express-rate-limit";
import { Router } from "express";
import type { AdminStore } from "../admin/store.js";
import { requireAuth, requireRoles } from "../auth/middleware.js";
import type { AuthStore } from "../auth/store.js";
import { HttpError } from "../middleware/errors.js";
import type { AccountService } from "../auth/accounts.js";

export function adminRoutes(auth: AuthStore, admin: AdminStore, accounts?: AccountService) {
  const router = Router();
  router.use(requireAuth(auth), requireRoles("admin"));
  router.get("/doctors", async (_request, response) => {
    response.json({ doctors: await admin.listDoctors() });
  });
  router.post("/doctors", async (request, response) => {
    if (!accounts) throw new HttpError(503, "EMAIL_UNAVAILABLE", "Email delivery is not configured.");
    response.status(201).json({ invitation: await accounts.inviteDoctor(request.body) });
  });
  router.post("/doctors/direct",rateLimit({windowMs:60000,limit:10,standardHeaders:"draft-8",legacyHeaders:false}),async(request,response)=>{
 if(!accounts) throw new HttpError(503,"UNAVAILABLE","Account service unavailable.");
 response.setHeader("Cache-Control","no-store");response.status(201).json(await accounts.createDoctor(request.body));
 });
 const doctorId=(value: unknown)=>{
   if(typeof value!=="string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)) throw new HttpError(400,"INVALID_INPUT","Invalid Doctor ID.");
   return value;
 };
 router.delete("/doctors/:id",async(request,response)=>{
   if(!admin.deleteDoctor) throw new HttpError(503,"UNAVAILABLE","Try again later.");
   const result=await admin.deleteDoctor(doctorId(request.params.id));
   if(result==="not_found") throw new HttpError(404,"NOT_FOUND","Doctor not found.");
   if(result!=="deleted") throw new HttpError(409,"DOCTOR_HAS_DEPENDENCIES","Doctor has related records. Disable the account to preserve them.");
   response.status(204).end();
 });
 router.post("/doctors/:id/disable",async(request,response)=>{
   if(!admin.disableDoctor) throw new HttpError(503,"UNAVAILABLE","Try again later.");
   if(!await admin.disableDoctor(doctorId(request.params.id))) throw new HttpError(404,"NOT_FOUND","Doctor not found.");
   response.status(204).end();
 });
 return router;
}
