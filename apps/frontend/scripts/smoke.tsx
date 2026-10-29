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
import { createMemoryRouter, RouterProvider, Outlet, useLocation } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { routes as applicationRoutes } from "../src/app/routes";
import { AuthContext, type AuthValue } from "../src/auth/context";
import { safeReturnTo } from "../src/auth/api";
const testAuth: AuthValue = { user: null, demo: true, expired: false, login: async () => { throw new Error("Not used in SSR"); }, register: async () => {}, logout: async () => {}, enterDemo: async () => {} };
// Keep existing demo page checks explicit; production routes default to unauthenticated.
export function DemoFixture() {
  const { pathname } = useLocation();
  const role = pathname.startsWith("/doctor/") ? "doctor" : pathname.startsWith("/admin/") ? "admin" : null;
  return <AuthContext value={role ? { ...testAuth, demo: false, user: { id: "fixture", name: "Fixture", email: "fixture@example.test", role } } : testAuth}><Outlet /></AuthContext>;
}
const routes = [{ element: <DemoFixture />, children: applicationRoutes }];
assert.equal(safeReturnTo("https://example.com", "patient"), "/patient/dashboard");
assert.equal(safeReturnTo("//example.com", "patient"), "/patient/dashboard");
assert.equal(safeReturnTo("/admin/dashboard", "patient"), "/patient/dashboard");
assert.equal(safeReturnTo("/patient/measurements?a=1#history", "patient"), "/patient/measurements?a=1#history");
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
import { Sidebar } from "../src/components/layout/Sidebar";
import { Preferences } from "../src/components/layout/Preferences";
import { PublicHeader } from "../src/components/public/PublicHeader";
import { roleNavigation } from "../src/components/layout/navigation";
import HomePage from "../src/pages/public/HomePage";
import AuthPage from "../src/pages/auth/AuthPage";
import { Feedback } from "../src/components/ui/Feedback";
import { SectionHeading } from "../src/components/ui/SectionHeading";
import { Button } from "../src/components/ui/Button";
import { I18nContext, type I18nValue } from "../src/i18n/context";
import type { TranslationVariables } from "../src/i18n/catalogTypes";
import { ThemeContext } from "../src/theme/context";

const busyButton = renderToString(<Button loading>Working</Button>);
assert(busyButton.includes('aria-busy="true"') && busyButton.includes('disabled=""'));
assert(!renderToString(<Button>Ready</Button>).includes('aria-busy="true"'));
assert(renderToString(<Feedback kind="error">Error</Feedback>).includes('role="alert"'));
assert(renderToString(<Feedback kind="success">Saved</Feedback>).includes('role="status"'));
assert(!renderToString(<Feedback kind="empty">Empty</Feedback>).includes('role='));
assert(renderToString(<SectionHeading id="example-heading" title="Example" />).includes('<h2 id="example-heading">Example</h2>'));

for (const role of ["patient", "doctor", "admin"] as const) {
  assert(roleNavigation(role).every(item => item.to.startsWith(`/${role}/`)), "Navigation stays within its role");
}

for (const language of ["ar", "en"] as const) {
  const context: I18nValue = {
    language, setLanguage: () => undefined,
    t: (key: string, variables?: TranslationVariables) => isTranslationKey(key) ? translateCatalogMessage(language, key, variables) : key,
    ...localeSettings(language), ...createFormatters(language),
  };
  const guest = { ...testAuth, demo: false };
  for (const [path, element] of [["/", <HomePage />], ["/login", <AuthPage mode="login" />], ["/register", <AuthPage mode="register" />]] as const) {
    const html = renderToString(<I18nContext value={context}><AuthContext value={guest}><RouterProvider router={createMemoryRouter([{ path, element }], { initialEntries: [path] })} /></AuthContext></I18nContext>);
    assert.equal((html.match(/class="topbar glass"/g) ?? []).length, 1, "One shared public masthead; nested chart headings are semantic headers");
    assert.equal((html.match(/<footer/g) ?? []).length, 1, "One shared public footer on home and account pages");
    assert(html.includes('href="/#features"') && html.includes('href="/login"'));
    assert(html.includes(translateCatalogMessage(language, "public.navigation")));
    assert(html.includes('id="public-content"'));
    assert(html.includes('data-i18n="declarative"'));
    assert(!html.includes("public.heroTitle"));
    assert(html.includes(translateCatalogMessage(language, path === "/" ? "public.living.heroTitle" : path === "/login" ? "auth.signIn" : "auth.register")));
    if (path !== "/") {
      assert(html.includes('aria-controls="auth-password"'));
      assert(html.includes('aria-describedby="password-hint"'));
      assert(/\bautocomplete="username"/i.test(html), "Email keeps its username autocomplete hint");
    } else {
      for (const section of ["immersive-intro", "signature-artwork", "health-canvas", "story-sequence", "weekly-scene", "medication-scene", "habits-scene", "report-scene", "assistant-scene"]) assert(html.includes(section), `Living homepage renders ${section}`);
      for (const obsolete of ['class="launch-hero"', 'class="public-hero"', 'class="bento-grid"', 'class="product-window"']) assert(!html.includes(obsolete), "Previous visual compositions are not mounted");
      assert.equal((html.match(/class="chart-point/g) ?? []).length, 7, "Seven real sample-day controls");
      assert(html.includes('aria-label="' + translateCatalogMessage(language, "public.living.chooseType") + '"'));
      assert(html.includes(translateCatalogMessage(language, "public.living.fictional")));
      assert(html.includes('aria-controls="public-navigation"'));
    }
  }
  for (const role of ["patient", "doctor", "admin"] as const) {
    const html = renderToString(<I18nContext value={context}><AuthContext value={{ ...guest, user: { id: "fixture", name: "Fixture", email: "fixture@example.test", role } }}><RouterProvider router={createMemoryRouter([{ path: "/", element: <PublicHeader /> }])} /></AuthContext></I18nContext>);
    assert(html.includes(`href="/${role}/dashboard"`));
    assert(!html.includes('href="/login"'));
    assert(!html.includes('href="/register"'));
    assert(html.includes(translateCatalogMessage(language, "auth.logout")));
  }
  for (const mode of ["light", "dark", "system"] as const) {
    const html = renderToString(
      <I18nContext value={context}>
        <ThemeContext value={{ mode, resolved: mode === "dark" ? "dark" : "light", setMode: () => undefined, toggle: () => undefined }}>
          <RouterProvider router={createMemoryRouter([{ path: "/", element: <><Sidebar /><Preferences /></> }])} />
        </ThemeContext>
      </I18nContext>,
    );
    assert(html.includes(translateCatalogMessage(language, "common.navigation.measurements").replaceAll("&", "&amp;")));
    assert(html.includes(`aria-label="${translateCatalogMessage(language, "common.layout.mainNav")}"`));
    assert(html.includes(`aria-label="${translateCatalogMessage(language, "common.theme.label")}"`));
    const nextMode = mode === "light" ? "dark" : mode === "dark" ? "system" : "light";
    assert(html.includes('title="' + translateCatalogMessage(language, "common.preferences.nextTheme", { theme: translateCatalogMessage(language, `common.theme.${nextMode}`) }) + '"'));
    assert(html.includes("data-i18n=\"declarative\""));
    assert(!html.includes("common.navigation."));
  }
}
import { readLanguage, persistLanguage, localeSettings, applyDocumentLanguage } from "../src/i18n/locale";
import { createFormatters } from "../src/i18n/formatters";

const languageStore = new Map<string, string>();
const testStorage = { getItem: (key: string) => languageStore.get(key) ?? null, setItem: (key: string, value: string) => { languageStore.set(key, value); } };
assert.equal(readLanguage(testStorage), "ar");
persistLanguage(testStorage, "en");
assert.equal(readLanguage(testStorage), "en");
persistLanguage(testStorage, "ar");
assert.equal(readLanguage(testStorage), "ar");
const blockedStorage = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
assert.equal(readLanguage(blockedStorage), "ar");
assert.doesNotThrow(() => persistLanguage(blockedStorage, "en"));
const documentLanguage = { lang: "", dir: "" };
for (const language of ["ar", "en"] as const) {
  applyDocumentLanguage(documentLanguage, language);
  assert.equal(documentLanguage.lang, language);
  assert.equal(documentLanguage.dir, language === "ar" ? "rtl" : "ltr");
  assert.equal(localeSettings(language).isRtl, language === "ar");
  const formatter = createFormatters(language);
  assert.equal(formatter.formatNumber(1234), new Intl.NumberFormat(localeSettings(language).locale).format(1234));
  assert.equal(formatter.formatUnit("mmHg"), "mmHg");
  assert.equal(formatter.formatUnit("mg/dL"), "mg/dL");
  const input = new Date("2026-01-02T13:04:00Z");
  assert(formatter.formatDate(input, { timeZone: "UTC", year: "numeric" }).includes("2026"));
  assert(formatter.formatTime(input, { timeZone: "UTC", hour12: false }).includes("13:04"));
  assert(formatter.formatDateTime(input, { timeZone: "UTC" }).length > 0);
}
import { inspectMessage, placeholders, reportTranslationIssue } from "../src/i18n/safety";

assert.deepEqual(inspectMessage(undefined), ["missing-key"]);
assert.deepEqual(inspectMessage("Welcome {{name}}"), ["missing-value:name"]);
assert.deepEqual(inspectMessage("{{count}}", { count: 0 }), []);
assert.deepEqual(inspectMessage("{{name}}", { name: "" }), []);
assert.deepEqual(inspectMessage("Welcome {{name}"), ["malformed-placeholder"]);
assert.equal(placeholders("{{bad-name}}").malformed, true);
assert.deepEqual(placeholders("{{name}} {{name}}").names, ["name"]);
assert.doesNotThrow(() => reportTranslationIssue("missing", ["missing-key"], false));
import {
  auditTranslationCatalogs,
  findMissingTranslationKeys,
  findUnusedTranslationKeys,
  getCatalogKeys,
  isTranslationKey,
  translateCatalogMessage,
} from "../src/i18n/catalog";

assert.deepEqual(getCatalogKeys("ar"), getCatalogKeys("en"));
assert.deepEqual(findMissingTranslationKeys("ar", "en"), []);
assert.deepEqual(findMissingTranslationKeys("en", "ar"), []);
assert.equal(isTranslationKey("patient.dashboard.welcome"), true);
assert.equal(isTranslationKey("patient.dashboard.missing"), false);
assert.equal(
  translateCatalogMessage("ar", "patient.dashboard.welcome", { name: "سارة" }),
  "مرحبًا سارة",
);
assert.equal(
  translateCatalogMessage("en", "patient.dashboard.welcome", { name: "Sarah" }),
  "Welcome Sarah",
);
const unusedFixtureKeys = findUnusedTranslationKeys([
  "common.actions.cancel",
  "patient.dashboard.welcome",
]);
assert(!unusedFixtureKeys.includes("common.actions.cancel"));
assert(unusedFixtureKeys.includes("reports.period"));
assert.deepEqual(
  auditTranslationCatalogs(["common.actions.cancel"]).missingInEnglish,
  [],
);
console.log(
  "PASS: Arabic/English catalog parity, missing-key detection, unused-key detection and interpolation.",
);

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
for (const language of ["ar", "en", "ar", "en"] as const) {
  const client = new QueryClient();
  client.setQueryData(queryKeys.dashboard, await getPatientDashboard());
  const context: I18nValue = { language, setLanguage: () => undefined, t: (key: string, values?: Readonly<Record<string, string | number>>) => isTranslationKey(key) ? translateCatalogMessage(language, key, values) : key, ...localeSettings(language), ...createFormatters(language) };
  const html = renderToString(<I18nContext value={context}><QueryClientProvider client={client}><RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/patient/dashboard?demo=1#main"] })} /></QueryClientProvider></I18nContext>);
  assert(html.includes(translateCatalogMessage(language, "patient.living.welcomeBody")));
  assert(html.includes(translateCatalogMessage(language, "patient.living.seriesNote")));
  assert(html.includes(translateCatalogMessage(language, "patient.living.disclosure")));
  assert(html.includes(translateCatalogMessage(language, "patient.overview.tasks")));
  assert(!html.includes("patient.overview."));
  assert(html.includes("<bdi>"), "Profile name must use bidi isolation");
  assert(html.includes("\u2068") && html.includes("\u2069"), "Welcome name must be isolated from surrounding direction");
  client.setQueryData(queryKeys.measurements, await getMeasurements());
  const measurementHtml = renderToString(<I18nContext value={context}><QueryClientProvider client={client}><RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/patient/measurements"] })} /></QueryClientProvider></I18nContext>);
  assert(measurementHtml.includes(translateCatalogMessage(language, "measurements.ui.history")));
  assert(measurementHtml.includes(translateCatalogMessage(language, "measurements.ui.example")));
  assert(!measurementHtml.includes("measurements.ui."));
  const invalidReading = measurementSchema.safeParse({ kind: "bloodPressure", systolic: 80, diastolic: 90 });
  assert.equal(invalidReading.success, false);
  if (!invalidReading.success) {
    assert(invalidReading.error.issues.some((issue) => issue.message === "measurements.ui.diastolicOrder"));
    assert(translateCatalogMessage(language, "measurements.ui.diastolicOrder").length > 0);
  }
  assert.notEqual(translateCatalogMessage(language, "measurements.ui.saved"), "measurements.ui.saved");
  client.setQueryData(queryKeys.measurements, []);
  const emptyHtml = renderToString(<I18nContext value={context}><QueryClientProvider client={client}><RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/patient/measurements"] })} /></QueryClientProvider></I18nContext>);
  assert(emptyHtml.includes(translateCatalogMessage(language, "measurements.ui.first")));
  client.setQueryData(queryKeys.habits, await getHabits());
  const habitsHtml = renderToString(<I18nContext value={context}><QueryClientProvider client={client}><RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/patient/habits"] })} /></QueryClientProvider></I18nContext>);
  const formatter = createFormatters(language);
  const sentence = translateCatalogMessage(language, "habits.ui.progress", { value: formatter.formatNumber(4500), target: formatter.formatNumber(10000), unit: formatter.formatHabitUnit("steps", 10000) });
  const cups = translateCatalogMessage(language, "habits.ui.progress", { value: formatter.formatNumber(6), target: formatter.formatNumber(8), unit: formatter.formatHabitUnit("cups", 8) });
  assert(habitsHtml.includes(sentence));
  assert(habitsHtml.includes(cups));
  if (language === "en") {
    assert.equal(sentence, "4,500 of 10,000 steps");
    assert.equal(cups, "6 of 8 cups");
    assert(habitsHtml.includes("0 of 2 completed habits"));
    assert(!/[\u0600-\u06ff]/.test(sentence + cups));
    assert.equal(formatter.formatHabitUnit("steps", 1), "step");
    assert.equal(formatter.formatHabitUnit("cups", 0), "cups");
  } else {
    assert.equal(sentence, "4,500 من 10,000 خطوة");
    assert.equal(cups, "6 من 8 أكواب");
  }
  client.clear();
}
for (const path of paths) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(queryKeys.dashboard, await getPatientDashboard());
  client.setQueryData(queryKeys.measurements, await getMeasurements());
  client.setQueryData(queryKeys.medications, await getMedications());
  client.setQueryData(queryKeys.habits, await getHabits());
  if (path === "/patient/reports") {
    const { getPatientReport: loadReport } = await import("../src/lib/api/reports");
    client.setQueryData([...queryKeys.reports, 7], await loadReport(7));
  }
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
    assert(html.includes('class="dashboard-living-grid"'), "Living canvas and routine form the primary workspace");
    assert(html.includes('class="dashboard-primary"') && html.includes('class="dashboard-routine"'), "Chart and daily routine retain distinct regions");
    assert(html.indexOf('class="dashboard-primary"') < html.indexOf('class="dashboard-routine"'), "The health canvas leads the reading order");
    assert(html.includes('class="living-public living-dashboard"'), "Dashboard opts into the approved Living tokens");
    assert(html.includes('class="dashboard-assistant glass"'), "Assistant preview remains accessible through native disclosure");
    assert(!html.includes('class="dashboard-board"') && !html.includes('class="routine-strip metrics-grid"'), "Previous dashboard composition is not mounted");
    assert(html.includes('class="clinical-app-body"') && html.includes('class="app-stage"'), "One shared shell with a quiet navigation rail");
    assert.equal((html.match(/<header/g) ?? []).length, 1, "One application header");
    assert(html.includes("بيانات مثال"));
    assert(!html.includes("طبيعي"));
  }
  if (path === "/patient/measurements")
    assert(html.includes("بيانات مثال"));
  if (path !== "/patient/dashboard" && path !== "/patient/measurements" && path !== "/patient/medications" && path !== "/patient/habits" && path !== "/patient/reports")
    assert(!html.includes('class="living-public living-dashboard"'), `Dashboard styles must not opt in on ${path}`);
  if (path === "/patient/measurements") {
    assert(html.includes('class="living-public living-dashboard living-measurements"'), "Measurements reuse the approved Living shell");
    assert(html.includes('data-kind="bloodPressure"') && html.includes('data-kind="glucose"'), "Reading types retain distinct visual cues");
    assert(html.includes('class="measurement-filter-heading dashboard-panel-heading"'), "Filters reuse the approved patient panel heading");
    assert(html.includes('class="measurement-results dashboard-primary health-canvas glass"'), "History reuses the approved patient canvas surface");
    assert(html.includes('class="measurements-heading dashboard-welcome"'), "Measurements reuse the approved open patient heading");
  }
  if (path === "/patient/medications") {
    assert(html.includes('class="living-public living-dashboard living-medications"'), "Medications reuse the approved patient shell");
    assert(html.includes('class="medications-heading dashboard-welcome"'), "Medication management reuses the open patient heading");
    assert(html.includes('class="card medication-summary glass"'), "Daily dose summary uses the approved Living surface");
    assert(html.includes('class="card medication-schedule glass"'), "Schedules use the approved Living surface");
    assert(html.includes('class="dashboard-feature-icon"'), "Medication icons reuse the approved feature treatment");
    assert(html.includes('class="living-pulse"') && html.includes('class="signature-artwork"'), "Shared Pulse and Tidal Weave remain decorative");
    assert(html.includes('aria-pressed="true"') && html.includes('aria-pressed="false"'), "Recorded and pending dose actions remain available");
    assert(!html.includes('class="feature-workbench"'), "Medication management has its own summary-and-schedules composition");
  }
  if (path === "/patient/habits") {
    assert(html.includes('class="living-public living-dashboard living-habits"'), "Habits reuse the approved patient shell");
    assert(html.includes('class="habits-heading dashboard-welcome"'), "Daily tracking uses the approved open heading");
    assert(html.includes('class="card habit-summary glass"'), "Today's overview uses the shared surface");
    assert(html.includes('class="card habit-detail glass"'), "Habit cards use the shared surface");
    assert(html.includes('class="habit-card-heading dashboard-panel-heading"'), "Habit icons and heading reuse patient primitives");
    assert(html.includes('class="living-pulse"') && html.includes('class="signature-artwork"'), "Only shared decorative artwork and motion are mounted");
    assert(html.includes('class="habits-grid"') && !html.includes('class="feature-workbench"'), "Daily completion lives alongside the introduction, ahead of the habit cards");
  }
  if (path === "/patient/reports") {
    assert(html.includes('class="living-public living-dashboard living-reports"'), "Reports reuse the approved patient shell");
    assert(html.includes('class="reports-heading dashboard-welcome"'), "Reports use the shared open heading and artwork");
    assert.equal((html.match(/class="card report-stat /g) ?? []).length, 4, "Only the four existing statistics are shown");
    assert.equal((html.match(/class="card report-chart-panel health-canvas glass"/g) ?? []).length, 2, "Both existing charts use the Dashboard canvas surface");
    assert(html.includes('class="card report-readings glass"'), "The latest-five ledger uses a shared surface");
    assert(html.includes("لا يتوفر سجل تاريخي") && html.includes("لا يتضمن التقرير تقييمًا طبيًا"), "Current-day scope and medical safety disclosures remain explicit");
    const readableHtml = html.replace(/<!--[\s\S]*?-->/g, "");
    assert(readableHtml.includes("2/3") && readableHtml.includes("0/2"), "Current-day dose and habit totals are retained");
  }
  router.dispose();
  if (path.startsWith("/doctor/") || path.startsWith("/admin/")) {
    assert(html.includes("app-frame role-"), "Staff pages share the application shell");
    assert(!html.includes('href="/patient/measurements"'), "No patient navigation in staff workspace");
  }
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
