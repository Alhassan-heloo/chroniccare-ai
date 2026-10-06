import {
  getMedications,
  addMedication,
  updateMedication,
  deleteMedication,
  setDoseTaken,
} from "../src/lib/api/medications";
import { medicationSchema } from "../src/lib/utils/medicationSchema";
import { summarizeMedications } from "../src/lib/utils/medications";
import assert from "node:assert/strict";
import { renderToString } from "react-dom/server";
import { createMemoryRouter, RouterProvider } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { routes } from "../src/app/routes";
import { queryKeys } from "../src/lib/query/queryKeys";
import {
  getPatientDashboard,
  addMeasurement,
  getMeasurements,
  toggleHabit,
  updateMeasurement,
  deleteMeasurement,
} from "../src/lib/api/patient";
import { measurementSchema } from "../src/lib/utils/measurementSchema";

import { filterMeasurements } from "../src/lib/utils/measurementFilters";
import type { Measurement } from "../src/lib/types/measurement";

const paths = [
  "/",
  "/login",
  "/register",
  "/patient/dashboard",
  "/patient/measurements",
  "/patient/medications",
  "/patient/habits",
  "/patient/reports",
  "/patient/assistant",
  "/patient/profile",
  "/doctor/dashboard",
  "/doctor/patients",
  "/admin/dashboard",
  "/missing",
];
for (const path of paths) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(queryKeys.dashboard, await getPatientDashboard());
  client.setQueryData(queryKeys.measurements, []);
  client.setQueryData(queryKeys.medications, await getMedications());
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const html = renderToString(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  assert(html.includes("<main"), `Missing main for ${path}`);
  assert(!html.includes("تعذر عرض الصفحة"), `Error boundary at ${path}`);
  if (path === "/patient/dashboard")
    for (const value of ["120/80", "98", "2/3", "4,500", "مرحبًا", "ماذا علي"])
      assert(html.includes(value), `Missing dashboard value: ${value}`);
  router.dispose();
  client.clear();
}
assert(
  measurementSchema.safeParse({
    kind: "bloodPressure",
    systolic: 120,
    diastolic: 80,
  }).success,
);
assert(
  !measurementSchema.safeParse({
    kind: "bloodPressure",
    systolic: 80,
    diastolic: 120,
  }).success,
);
assert(!measurementSchema.safeParse({ kind: "glucose", value: NaN }).success);
assert(!measurementSchema.safeParse({ kind: "glucose", value: -1 }).success);
await addMeasurement({ kind: "glucose", value: 110 });
assert.equal((await getPatientDashboard()).glucose.value, 110);
assert.equal((await getPatientDashboard()).glucose.isExample, false);
assert.equal((await getMeasurements()).length, 1);
await setDoseTaken({ id: "demo-pressure", time: "20:00", taken: true });
assert.equal((await getPatientDashboard()).medication.taken, 3);
await toggleHabit("walk");
assert.equal((await getPatientDashboard()).habits[0]?.completed, true);
console.log(
  "PASS: 14 route renders, dashboard content, schema validation, mock updates. Browser layout and interactions not covered.",
);

// CRUD consistency: changing older records must not replace the latest card.
for (const item of await getMeasurements()) await deleteMeasurement(item.id);
const older = await addMeasurement({ kind: "glucose", value: 101 });
const latest = await addMeasurement({ kind: "glucose", value: 115 });
await updateMeasurement({
  id: older.id,
  input: { kind: "glucose", value: 99 },
});
assert.equal((await getPatientDashboard()).glucose.value, 115);
const edited = await updateMeasurement({
  id: latest.id,
  input: { kind: "glucose", value: 108 },
});
assert.equal(edited.recordedAt, latest.recordedAt);
assert.equal((await getPatientDashboard()).glucose.value, 108);
await deleteMeasurement(latest.id);
assert.equal((await getPatientDashboard()).glucose.value, 99);
await updateMeasurement({
  id: older.id,
  input: { kind: "bloodPressure", systolic: 130, diastolic: 85 },
});
assert.equal((await getPatientDashboard()).glucose.isExample, true);
assert.equal((await getPatientDashboard()).bloodPressure.systolic, 130);
await deleteMeasurement(older.id);
assert.equal((await getPatientDashboard()).bloodPressure.isExample, true);
assert.equal((await getMeasurements()).length, 0);
await assert.rejects(() => deleteMeasurement("missing"));
await assert.rejects(() =>
  updateMeasurement({ id: "missing", input: { kind: "glucose", value: 100 } }),
);
const records: Measurement[] = [
  {
    id: "one",
    kind: "glucose",
    value: 90,
    recordedAt: new Date(2026, 9, 1, 0, 0).toISOString(),
  },
  {
    id: "two",
    kind: "bloodPressure",
    systolic: 120,
    diastolic: 80,
    recordedAt: new Date(2026, 9, 2, 23, 59).toISOString(),
  },
  {
    id: "three",
    kind: "glucose",
    value: 100,
    recordedAt: new Date(2026, 9, 3, 0, 0).toISOString(),
  },
];
assert.deepEqual(
  filterMeasurements(records, {
    kind: "all",
    from: "2026-10-01",
    to: "2026-10-02",
  }).map((item) => item.id),
  ["two", "one"],
);
assert.equal(
  filterMeasurements(records, { kind: "glucose", from: "", to: "" }).length,
  2,
);
assert.equal(
  filterMeasurements(records, { kind: "all", from: "2026-10-04", to: "" })
    .length,
  0,
);
assert.equal(
  filterMeasurements(records, {
    kind: "all",
    from: "2026-10-03",
    to: "2026-10-01",
  }).length,
  0,
);
console.log(
  "PASS: CRUD latest-reading consistency, type changes, timestamp preservation, missing records, inclusive local-date filters.",
);

// Medication operations and daily summary derive from the same schedule store.
const baseline = (await getPatientDashboard()).medication;
assert.equal(baseline.taken, 3);
await setDoseTaken({ id: "demo-pressure", time: "20:00", taken: true });
assert.equal(
  (await getPatientDashboard()).medication.taken,
  3,
  "Repeated registration is idempotent",
);
await setDoseTaken({ id: "demo-pressure", time: "20:00", taken: false });
assert.equal((await getPatientDashboard()).medication.taken, 2);
const input = {
  name: "دواء تجريبي",
  dosage: "حسب الوصفة",
  notes: "",
  doses: [{ time: "12:30" }, { time: "21:00" }],
};
const med = await addMedication(input);
assert.equal((await getPatientDashboard()).medication.total, 5);
await setDoseTaken({ id: med.id, time: "12:30", taken: true });
const changed = await updateMedication({
  id: med.id,
  input: {
    ...input,
    name: "اسم معدل",
    doses: [{ time: "12:30" }, { time: "22:00" }],
  },
});
assert(changed.doses[0]?.takenOn);
assert.equal(changed.doses[1]?.takenOn, null);
assert.equal((await getPatientDashboard()).medication.taken, 3);
assert.equal(
  summarizeMedications([changed], "2099-01-01").taken,
  0,
  "Old day registrations do not count for new day",
);
assert(!medicationSchema.safeParse({ ...input, name: " " }).success);
assert(!medicationSchema.safeParse({ ...input, dosage: "" }).success);
assert(!medicationSchema.safeParse({ ...input, doses: [] }).success);
assert(
  !medicationSchema.safeParse({ ...input, doses: [{ time: "25:00" }] }).success,
);
assert(
  !medicationSchema.safeParse({
    ...input,
    doses: [{ time: "08:00" }, { time: "08:00" }],
  }).success,
);
assert(
  !medicationSchema.safeParse({
    ...input,
    doses: Array.from({ length: 7 }, (_, i) => ({ time: `0${i}:00` })),
  }).success,
);
await assert.rejects(() =>
  addMedication({ ...input, doses: [{ time: "invalid" }] }),
);
await assert.rejects(() => updateMedication({ id: "missing", input }));
await assert.rejects(() => deleteMedication("missing"));
await assert.rejects(() =>
  setDoseTaken({ id: med.id, time: "23:59", taken: true }),
);
await deleteMedication(med.id);
assert.equal((await getPatientDashboard()).medication.total, 3);
assert.equal((await getPatientDashboard()).medication.taken, 2);
for (const item of await getMedications()) await deleteMedication(item.id);
assert.equal((await getMedications()).length, 0);
assert.equal((await getPatientDashboard()).medication.total, 0);
assert.equal((await getPatientDashboard()).medication.taken, 0);
assert.equal((await getPatientDashboard()).medication.nextDose, null);
console.log(
  "PASS: Medication CRUD, validation, dose registration/undo, idempotency, retained times, new-day reset and empty summaries.",
);
