import {
  getHabits,
  addHabit,
  updateHabit,
  deleteHabit,
  setHabitProgress,
} from "../src/lib/api/habits";
import {
  habitSchema,
  habitProgressSchema,
  progressToday,
  habitPercent,
} from "../src/lib/utils/habits";
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
  updateMeasurement,
  deleteMeasurement,
} from "../src/lib/api/patient";
import { measurementSchema } from "../src/lib/utils/measurementSchema";

import { filterMeasurements } from "../src/lib/utils/measurementFilters";
import type { Measurement } from "../src/lib/types/measurement";
import { translateToEnglish } from "../src/i18n/translate";
import { updateTextIfChanged } from "../src/i18n/domTranslation";

const translatedChartLabel = translateToEnglish(
  "اتجاه قراءات الضغط المسجلة خلال آخر 7 أيام، بوحدة mmHg",
);
assert.equal(
  translatedChartLabel,
  "Trend of recorded blood pressure readings over the last 7 days, in mmHg",
);
assert(!/[\u0600-\u06ff]/.test(translatedChartLabel));
assert.equal(
  translateToEnglish("  متابعة يومية،\n بخطوات بسيطة.  "),
  "Daily follow-up, in simple steps.",
);
const unchangedTextNode = { textContent: "Systolic" };
assert.equal(updateTextIfChanged(unchangedTextNode, "Systolic"), false);
assert.equal(unchangedTextNode.textContent, "Systolic");
assert.equal(updateTextIfChanged(unchangedTextNode, "Diastolic"), true);
assert.equal(unchangedTextNode.textContent, "Diastolic");

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
  client.setQueryData(queryKeys.measurements, await getMeasurements());
  client.setQueryData(queryKeys.medications, await getMedications());
  client.setQueryData(queryKeys.habits, await getHabits());
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
  if (path === "/patient/dashboard") {
    assert(html.includes("بيانات مثال"));
    assert(!html.includes("طبيعي"));
  }
  if (path === "/patient/measurements")
    assert(html.includes("بيانات مثال"));
  router.dispose();
  client.clear();
}
// Demo week shares the same log used by measurements and reports.
const seededReadings = await getMeasurements();
assert.equal(seededReadings.length, 14);
assert(seededReadings.every((item) => item.isExample === true));
const { getPatientReport: getSeedReport } = await import(
  "../src/lib/api/reports"
);
const seededReport = await getSeedReport(7);
assert.equal(seededReport.points.length, 7);
assert.equal(seededReport.pressure.count, 7);
assert.equal(seededReport.glucose.count, 7);
assert(seededReport.points.every((point) => point.isExample === true));
const seededDashboard = await getPatientDashboard();
assert.equal(seededDashboard.weekly.length, seededReport.points.length);
assert.deepEqual(seededDashboard.weekly, seededReport.points);
assert.equal(seededDashboard.bloodPressure?.isExample, true);
assert.equal(seededDashboard.glucose?.isExample, true);
assert(
  seededReadings.every(
    (item) => new Date(item.recordedAt).getTime() <= Date.now(),
  ),
);
for (const item of seededReadings) await deleteMeasurement(item.id);

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
assert.equal((await getPatientDashboard()).glucose?.value, 110);
assert.equal((await getPatientDashboard()).glucose?.isExample, false);
assert.equal((await getPatientDashboard()).weekly.at(-1)?.glucose, 110);
assert.equal((await getMeasurements()).length, 1);
await setDoseTaken({ id: "demo-pressure", time: "20:00", taken: true });
assert.equal((await getPatientDashboard()).medication.taken, 3);
await setHabitProgress({ id: "steps", value: 10000 });
assert.equal((await getPatientDashboard()).habits[0]?.progress, 10000);
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
assert.equal((await getPatientDashboard()).glucose?.value, 115);
const edited = await updateMeasurement({
  id: latest.id,
  input: { kind: "glucose", value: 108 },
});
assert.equal(edited.recordedAt, latest.recordedAt);
assert.equal((await getPatientDashboard()).glucose?.value, 108);
assert.equal((await getPatientDashboard()).weekly.at(-1)?.glucose, 103.5);
await deleteMeasurement(latest.id);
assert.equal((await getPatientDashboard()).glucose?.value, 99);
await updateMeasurement({
  id: older.id,
  input: { kind: "bloodPressure", systolic: 130, diastolic: 85 },
});
assert.equal((await getPatientDashboard()).glucose, null);
assert.equal((await getPatientDashboard()).bloodPressure?.systolic, 130);
await deleteMeasurement(older.id);
assert.equal((await getPatientDashboard()).bloodPressure, null);
assert.equal((await getPatientDashboard()).glucose, null);
assert.equal((await getPatientDashboard()).weekly.length, 0);
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

const habitInput = {
  title: "تمرين يومي",
  unit: "minutes" as const,
  target: 20,
};
const habit = await addHabit(habitInput);
assert.equal(habit.progress, 0);
await setHabitProgress({ id: habit.id, value: 12 });
assert.equal(
  (await getPatientDashboard()).habits.find((h) => h.id === habit.id)?.progress,
  12,
);
let changedHabit = await updateHabit({
  id: habit.id,
  input: { ...habitInput, target: 10 },
});
assert.equal(changedHabit.progress, 12);
assert.equal(habitPercent(changedHabit), 100);
assert.equal(progressToday(changedHabit, "2099-01-01"), 0);
changedHabit = await updateHabit({
  id: habit.id,
  input: { ...habitInput, unit: "times" },
});
assert.equal(changedHabit.progress, 0);
await setHabitProgress({ id: habit.id, value: 4 });
await setHabitProgress({ id: habit.id, value: 4 });
assert.equal((await getHabits()).find((h) => h.id === habit.id)?.progress, 4);
assert(!habitSchema.safeParse({ ...habitInput, target: 0 }).success);
assert(!habitSchema.safeParse({ ...habitInput, title: " " }).success);
assert(!habitProgressSchema.safeParse(-1).success);
assert(!habitProgressSchema.safeParse(NaN).success);
assert(!habitProgressSchema.safeParse(1.5).success);
await assert.rejects(() => setHabitProgress({ id: habit.id, value: -2 }));
await deleteHabit(habit.id);
assert(!(await getPatientDashboard()).habits.some((h) => h.id === habit.id));
await assert.rejects(() => deleteHabit(habit.id));
for (const h of await getHabits()) await deleteHabit(h.id);
assert.equal((await getPatientDashboard()).habits.length, 0);
console.log(
  "PASS: habit CRUD, target changes, unit reset, validation, new day and dashboard sync.",
);

// Report period boundaries and daily averages use recorded measurements only.
const { summarizeReport } = await import("../src/lib/utils/reports");
const now = new Date(2026, 9, 10, 12);
const recorded = (day: number, hour = 12) =>
  new Date(2026, 9, day, hour).toISOString();
const reportReadings: Measurement[] = [
  { id: "start", kind: "glucose", value: 100, recordedAt: recorded(4, 0) },
  { id: "same-day", kind: "glucose", value: 120, recordedAt: recorded(4, 10) },
  { id: "old", kind: "glucose", value: 500, recordedAt: recorded(3) },
  { id: "future", kind: "glucose", value: 500, recordedAt: recorded(10, 13) },
  {
    id: "pressure",
    kind: "bloodPressure",
    systolic: 130,
    diastolic: 80,
    recordedAt: recorded(10, 10),
  },
];
const report = summarizeReport(reportReadings, 7, now);
assert.equal(report.measurements.length, 3);
assert.equal(report.glucose.average, 110);
assert.equal(report.pressure.systolic, 130);
assert.equal(report.points[0]?.glucose, 110);
assert.equal(report.points[0]?.systolic, undefined);
assert.equal(report.points[1]?.glucose, undefined);
assert.equal(summarizeReport([], 30, now).glucose.average, null);
assert.equal(summarizeReport(reportReadings, 30, now).measurements.length, 4);
assert.equal(summarizeReport([], 90, now).points.length, 0);
console.log(
  "Reports: period boundaries, averages, empty data and missing series passed",
);

const { getPatientReport } = await import("../src/lib/api/reports");
const reportMeasurement = await addMeasurement({ kind: "glucose", value: 123 });
assert.equal((await getPatientReport(7)).glucose.average, 123);
await updateMeasurement({
  id: reportMeasurement.id,
  input: { kind: "glucose", value: 145 },
});
assert.equal((await getPatientReport(30)).glucose.average, 145);
await deleteMeasurement(reportMeasurement.id);
assert.equal((await getPatientReport(7)).glucose.average, null);
console.log(
  "Reports: live adapter reflects measurement add/edit/delete passed",
);
