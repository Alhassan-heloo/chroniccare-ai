import { Router } from "express";
import { requireAuth, requireRoles, type AuthLocals } from "../auth/middleware.js";
import type { AuthStore } from "../auth/store.js";
import type { DoctorStore } from "../doctor/store.js";
import { doctorPatientId } from "../doctor/validation.js";
import { HttpError } from "../middleware/errors.js";

const relationshipNotFound = () => new HttpError(404, "DOCTOR_PATIENT_NOT_FOUND", "Patient relationship not found.");

export function doctorRoutes(auth: AuthStore, doctors: DoctorStore) {
  const router = Router();
  router.use(requireAuth(auth), requireRoles("doctor"));
  router.get("/patients", async (_request, response) => {
    response.json({ patients: await doctors.listPatients((response.locals as AuthLocals).user.id) });
  });
  router.get("/patients/:patientId/activity", async (request, response) => {
    const doctorId = (response.locals as AuthLocals).user.id;
    const patientId = doctorPatientId(request.params.patientId);
    const events = await doctors.getPatientActivity(doctorId, patientId, request.query.date);
    if (!events) throw relationshipNotFound();
    response.json({ patientId, events });
  });
  router.get("/patients/:patientId", async (request, response) => {
    const doctorId = (response.locals as AuthLocals).user.id;
    const patientId = doctorPatientId(request.params.patientId);
    const record = await doctors.getPatientRecord(doctorId, patientId, request.query.date);
    if (!record) throw relationshipNotFound();
    response.json(record);
  });
  return router;
}
