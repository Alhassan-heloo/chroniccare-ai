import { Router } from "express";
import { requireAuth, requireRoles, type AuthLocals } from "../auth/middleware.js";
import type { AuthStore } from "../auth/store.js";
import type { DoctorStore } from "../doctor/store.js";
import { doctorPatientId } from "../doctor/validation.js";
import type { HabitStore } from "../habits/store.js";
import { habitDate } from "../habits/validation.js";
import type { MeasurementStore } from "../measurements/store.js";
import type { MedicationStore } from "../medications/store.js";
import { HttpError } from "../middleware/errors.js";

function day(value: unknown) {
  if (Array.isArray(value)) throw new HttpError(400, "INVALID_HABIT_DATE", "Date is invalid.");
  return habitDate(value);
}

export function doctorRoutes(
  auth: AuthStore,
  doctors: DoctorStore,
  measurements: MeasurementStore,
  medications: MedicationStore,
  habits: HabitStore,
) {
  const router = Router();
  router.use(requireAuth(auth), requireRoles("doctor"));
  router.get("/patients", async (_request, response) => {
    response.json({ patients: await doctors.listPatients((response.locals as AuthLocals).user.id) });
  });
  router.get("/patients/:patientId/activity", async (request, response) => {
    const doctorId = (response.locals as AuthLocals).user.id;
    const patientId = doctorPatientId(request.params.patientId);
    if (!await doctors.getPatient(doctorId, patientId)) throw new HttpError(404, "DOCTOR_PATIENT_NOT_FOUND", "Patient relationship not found.");
    const date = day(request.query.date);
    if (!doctors.activity) throw new HttpError(503, "ACTIVITY_UNAVAILABLE", "Stored activity is unavailable.");
    response.json({patientId, events: await doctors.activity(patientId,date)});
  });
  router.get("/patients/:patientId", async (request, response) => {
    const doctorId = (response.locals as AuthLocals).user.id;
    const patientId = doctorPatientId(request.params.patientId);
    const patient = await doctors.getPatient(doctorId, patientId);
    if (!patient) throw new HttpError(404, "DOCTOR_PATIENT_NOT_FOUND", "Patient relationship not found.");
    const date = day(request.query.date);
    const [patientMeasurements, patientMedications, patientHabits] = await Promise.all([
      measurements.list(patient.id),
      medications.list(patient.id, date),
      habits.list(patient.id, date),
    ]);
    response.json({
      patient,
      date,
      measurements: patientMeasurements,
      medications: patientMedications,
      habits: patientHabits,
    });
  });
  return router;
}
