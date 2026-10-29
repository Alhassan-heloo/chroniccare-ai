// Real-browser regression checks. Reuses an installed Playwright (or the desktop runtime).
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve, join } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const baseURL = process.env.RESPONSIVE_BASE_URL || "http://localhost:5174";
const output = resolve(process.env.RESPONSIVE_OUTPUT || "artifacts/responsive");
const quick = process.argv.includes("--quick");
const capture = process.argv.includes("--capture");
const verifyFonts = process.argv.includes("--fonts");
const widths = [320, 360, 375, 390, 430, 768, 1024, 1440];
const settings = quick && !verifyFonts ? [{ mode: "light", os: "light" }] : [
  { mode: "light", os: "light" }, { mode: "dark", os: "dark" },
  { mode: "system", os: "light" }, { mode: "system", os: "dark" },
];
const routes = ["/patient/dashboard", "/patient/measurements", "/patient/habits",
  "/patient/medications", "/patient/reports", "/patient/assistant", "/patient/profile",
  "/", "/login", "/register", "/doctor/dashboard", "/doctor/patients", "/admin/dashboard", "/not-found"];
const report = { baseURL, browser: "", height: 900, cases: [], issues: [], browserErrors: [], externalResourceErrors: [], interactions: [] };
// Cache the actual remote font responses across contexts, including failures. A blocked
// external service must not hang every navigation; failures remain in the evidence.
const fontResponses = new Map();
report.renderedFonts = [];
report.externalRequests = [];
report.navigationRetries = [];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "msedge", headless: true });
report.browser = browser.version();

async function settle(page) {
  await page.locator("h1").first().waitFor();
  // Fonts, lazy charts and the existing compatibility observer must finish before measuring.
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
}

async function measure(page, meta, screenshot = false) {
  const measurements = await page.evaluate(() => {
    const visible = (el) => el.getClientRects().length && getComputedStyle(el).visibility !== "hidden";
    const label = (el) => `${el.tagName.toLowerCase()}.${String(el.className?.baseVal ?? el.className).replaceAll(" ", ".")}`;
    const containers = [...document.querySelectorAll(".header,.header-actions,.preferences,.sidebar,.bottom-nav,main,.card,.welcome,.metric-card,.metric-number,.task-row,.chart,.measurement-entry,.filter-fields,.habit-detail,dialog[open],.field,.section-heading,.public-header,.hero,.report-chart")]
      .filter(visible).map((el) => ({ element: label(el), client: el.clientWidth, scroll: el.scrollWidth, overflow: el.scrollWidth - el.clientWidth }));
    // Sonner's empty positioning rail deliberately extends past its mobile inset;
    // test the actual toast children, not that invisible rail, for clipping.
    const outside = [...document.querySelectorAll("body *")].filter((el) => visible(el) && !el.matches("[data-sonner-toaster]") && !el.closest(".sr-only,.skip-link,.recharts-tooltip-wrapper,dialog:not([open])") && el.namespaceURI !== "http://www.w3.org/2000/svg")
      .map((el) => ({ element: label(el), left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right }))
      .filter((el) => el.left < -1 || el.right > innerWidth + 1);
    const cards = [...document.querySelectorAll(".metric-card")].map((el) => el.getBoundingClientRect().width);
    const overlaps = [];
    for (const row of document.querySelectorAll(".header-actions,.preferences,.metric-heading,.measurement-entry-actions,.confirmation-actions,.segmented,.dialog-heading,.medication-card-heading,.bottom-nav")) {
      const children = [...row.children].filter(visible);
      for (let i = 0; i < children.length; i++) for (let j = i + 1; j < children.length; j++) {
        const a = children[i].getBoundingClientRect(), b = children[j].getBoundingClientRect();
        if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) overlaps.push(`${label(row)}: ${label(children[i])} / ${label(children[j])}`);
      }
    }
    return { document: { client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth },
      containers, outside, cards, overlaps, loadedFonts: [...document.fonts].filter((font) => font.status === "loaded").map((font) => font.family), lang: document.documentElement.lang, dir: document.documentElement.dir,
      theme: document.documentElement.dataset.theme,
      themeControlVisible: [...document.querySelectorAll(".theme-select")].some(visible),
      horizontalConcealment: [document.documentElement, document.body].some((el) => ["hidden", "clip"].includes(getComputedStyle(el).overflowX)) };
  });
  const problems = [];
  if (measurements.document.scroll > measurements.document.client + 1) problems.push("document overflow");
  if (measurements.outside.length) problems.push("elements outside viewport");
  if (measurements.containers.some((el) => el.overflow > 1)) problems.push("container overflow");
  if (measurements.overlaps.length) problems.push("overlapping controls");
  if (measurements.cards.some((width) => width < 120)) problems.push("metric card narrower than 120px");
  if (meta.route.startsWith("/patient/") && !measurements.themeControlVisible) problems.push("system theme selector inaccessible");
  if (measurements.horizontalConcealment) problems.push("global overflow concealed");
  if (measurements.lang !== meta.language || measurements.dir !== (meta.language === "ar" ? "rtl" : "ltr")) problems.push("wrong locale/direction");
  if (measurements.theme !== (meta.mode === "system" ? meta.os : meta.mode)) problems.push("wrong resolved theme");
  let screenshotPath;
  let viewportScreenshotPath;
  if (screenshot || problems.length) {
    screenshotPath = join(output, `${meta.width}-${meta.language}-${meta.mode}-${meta.os}-${meta.route.replaceAll("/", "_")}${meta.dialog ? `-${meta.dialog}` : ""}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    if (capture) {
      viewportScreenshotPath = screenshotPath.replace(/\.png$/, "-viewport.png");
      await page.screenshot({ path: viewportScreenshotPath });
    }
  }
  const result = { ...meta, ...measurements, problems, screenshotPath, viewportScreenshotPath };
  report.cases.push(result);
  if (problems.length) report.issues.push(result);
}

async function dialogCheck(page, meta, trigger, name) {
  await trigger.click();
  await page.locator("dialog[open]").waitFor();
  await measure(page, { ...meta, dialog: name }, meta.width === 320);
  const dialog = page.locator("dialog[open]");
  assert.equal(await dialog.getAttribute("aria-labelledby") !== null, true);
  await page.keyboard.press("Escape");
  await page.locator("dialog[open]").waitFor({ state: "hidden" });
}

async function navigate(page, route) {
  const link = page.locator(`.sidebar a[href="${route}"],.bottom-nav a[href="${route}"]`).filter({ visible: true });
  if (await link.count()) await link.click();
  else {
    await page.locator(".bottom-nav button").last().click();
    await page.locator(`dialog[open] a[href="${route}"]`).click();
  }
  await settle(page);
}

async function exerciseInteractions(page, context, meta) {
  await page.goto(`${baseURL}/patient/dashboard?responsive=1#main`, { waitUntil: "domcontentloaded" });
  await settle(page);
  const originalURL = page.url();
  let language = meta.language;
  for (let i = 0; i < 6; i++) {
    await page.locator(".language-toggle").click();
    language = language === "ar" ? "en" : "ar";
    await page.waitForFunction((lang) => document.documentElement.lang === lang, language);
    assert.equal(page.url(), originalURL, "Switching language must preserve route/query/hash");
    assert.equal(await page.evaluate(() => localStorage.getItem("cc-language")), language);
    await measure(page, { ...meta, language, route: "/patient/dashboard", dialog: `language-switch-${i}` });
  }
  for (const mode of ["light", "dark", "system"]) {
    await page.locator("#theme-mode").selectOption(mode);
    assert.equal(await page.evaluate(() => localStorage.getItem("cc-theme")), mode);
    if (mode === "system") for (const os of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme: os });
      await page.waitForFunction((theme) => document.documentElement.dataset.theme === theme, os);
      await measure(page, { ...meta, language, mode, os, route: "/patient/dashboard", dialog: "live-os-switch" });
    }
  }
  await page.emulateMedia({ colorScheme: meta.os });
  await page.locator("#theme-mode").selectOption(meta.mode);
  const toggledMode = meta.mode === "light" ? "dark" : meta.mode === "dark" ? "system" : "light";
  await page.locator(".theme-toggle").click();
  await page.waitForFunction((expected) => localStorage.getItem("cc-theme") === expected, toggledMode);
  await page.waitForFunction((expected) => document.documentElement.dataset.theme === expected, toggledMode === "system" ? meta.os : toggledMode);
  assert.equal(await page.evaluate(() => document.documentElement.lang), language);
  await page.locator("#theme-mode").selectOption(meta.mode);
  await page.reload({ waitUntil: "domcontentloaded" });
  await settle(page);
  assert.equal(await page.evaluate(() => document.documentElement.lang), language);
  assert.equal(await page.locator("#theme-mode").inputValue(), meta.mode);
  assert.equal(page.url(), originalURL);
  await page.locator(".language-toggle").click();
  const persistedLanguage = language === "ar" ? "en" : "ar";
  await page.reload({ waitUntil: "domcontentloaded" });
  await settle(page);
  assert.equal(await page.evaluate(() => document.documentElement.lang), persistedLanguage);
  await page.locator(".language-toggle").click();
  await page.waitForFunction((lang) => document.documentElement.lang === lang, language);
  await page.locator(".add-reading").click();
  const form = page.locator("dialog[open] form");
  await form.locator('input[name="systolic"]').fill("125");
  await form.locator('input[name="diastolic"]').fill("85");
  await form.locator('button[type="submit"]').click();
  await page.locator("dialog[open]").waitFor({ state: "hidden" });
  await navigate(page, "/patient/measurements");
  assert.equal(await page.locator(".measurement-entry").count(), 15);
  await page.locator(".measurement-entry-actions button").first().click();
  await page.locator('dialog[open] input[name="systolic"]').fill("130");
  await page.locator('dialog[open] input[name="diastolic"]').fill("90");
  await page.locator('dialog[open] button[type="submit"]').click();
  await page.locator("dialog[open]").waitFor({ state: "hidden" });
  for (let i = 0; i < 2; i++) await page.locator(".language-toggle").click();
  assert.equal(await page.locator(".measurement-entry").count(), 15);
  assert.equal((await page.locator(".measurement-entry-value strong").first().innerText()).trim(), "130/90");
  await navigate(page, "/patient/dashboard");
  assert.equal((await page.locator(".metric-number").first().innerText()).trim(), "130/90");
  await navigate(page, "/patient/reports");
  await page.locator(".report-readings").waitFor();
  assert.match(await page.locator(".report-readings").innerText(), /130\/90/);
  await navigate(page, "/patient/measurements");
  await page.locator(".measurement-entry-actions button").nth(1).click();
  await page.locator("dialog[open] .btn-danger").click();
  await page.locator("dialog[open]").waitFor({ state: "hidden" });
  assert.equal(await page.locator(".measurement-entry").count(), 14);
  await navigate(page, "/patient/habits");
  await page.locator(".habits-actions > button").click();
  const longName = `روتين Wellness ${"A".repeat(60)}`;
  await page.locator('dialog[open] input[name="title"]').fill(longName);
  await page.locator('dialog[open] button[type="submit"]').click();
  await page.locator("dialog[open]").waitFor({ state: "hidden" });
  const habit = page.locator(".habit-detail").filter({ has: page.getByRole("heading", { name: longName, exact: true }) });
  await habit.waitFor();
  await measure(page, { ...meta, route: "/patient/habits", dialog: "long-mixed-direction-title" }, true);
  await habit.locator(":scope > button").click();
  await page.locator('dialog[open] input[type="number"]').fill("7");
  await page.locator('dialog[open] button[type="submit"]').click();
  await page.locator("dialog[open]").waitFor({ state: "hidden" });
  assert.match(await habit.locator(".habit-value").innerText(), /7/);
  await habit.locator(".medication-card-actions button").first().click();
  await measure(page, { ...meta, route: "/patient/habits", dialog: "long-title-edit-form" }, true);
  await page.keyboard.press("Escape");
  await habit.locator(".medication-card-actions button").nth(1).click();
  await measure(page, { ...meta, route: "/patient/habits", dialog: "long-title-delete" }, true);
  await page.locator("dialog[open] .btn-danger").click();
  await page.locator("dialog[open]").waitFor({ state: "hidden" });
  assert.equal(await page.locator(".habit-detail").count(), 2);
  report.interactions.push({ ...meta, status: "PASS", checks: ["6 language switches", "route/query/hash", "theme controls", "live system preference changes", "persistence/reload", "measurement CRUD/dashboard/report sync", "long mixed-direction habit/progress/delete"] });
}

let activePage;
try {
  for (const width of widths) for (const language of ["ar", "en"]) for (const setting of settings) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: setting.os, reducedMotion: "reduce" });
    await context.addInitScript(({ language, mode }) => {
      if (!localStorage.getItem("cc-language")) localStorage.setItem("cc-language", language);
      if (!localStorage.getItem("cc-theme")) localStorage.setItem("cc-theme", mode);
    }, { language, mode: setting.mode });
    await context.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, async (route) => {
      const url = route.request().url();
      if (!fontResponses.has(url)) fontResponses.set(url, (async () => {
        try {
          const response = await route.fetch({ timeout: 5000 });
          return { status: response.status(), headers: response.headers(), body: await response.body() };
        } catch (error) {
          report.externalResourceErrors.push({ url, message: error.message });
          return null;
        }
      })());
      const response = await fontResponses.get(url);
      if (response) await route.fulfill(response);
      else await route.abort();
    });
    if (verifyFonts) await context.route(/^https?:\/\//, async (route) => {
      if (new URL(route.request().url()).origin === new URL(baseURL).origin) await route.continue();
      else {
        report.externalRequests.push(route.request().url());
        await route.abort();
      }
    });
    const page = await context.newPage();
    activePage = page;
    page.on("pageerror", (error) => report.browserErrors.push({ width, language, ...setting, message: error.message }));
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        const item = { width, language, ...setting, type: message.type(), message: message.text(), url: message.location().url };
        if (/https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(item.url)) report.externalResourceErrors.push(item);
        else report.browserErrors.push(item);
      }
    });
    for (const route of routes) {
      try {
        await page.goto(`${baseURL}${route}`, { waitUntil: "domcontentloaded" });
      } catch (error) {
        if (!error.message.includes("net::ERR_ABORTED")) throw error;
        report.navigationRetries.push({ width, language, ...setting, route, message: error.message });
        await page.goto(`${baseURL}${route}`, { waitUntil: "load" });
      }
      await settle(page);
      if (route === "/patient/dashboard") await page.locator(".chart .recharts-surface").waitFor();
      if (route === "/patient/measurements") await page.locator(".measurement-entry").first().waitFor();
      if (route === "/patient/habits") await page.locator(".habit-detail").first().waitFor();
      if (route === "/patient/reports") await page.locator(".report-summary").waitFor();
      if (verifyFonts && route === "/patient/dashboard") {
        // CDP reports the actual glyph font, unlike computedStyle/font-family.
        const cdp = await context.newCDPSession(page);
        await cdp.send("DOM.enable");
        await cdp.send("CSS.enable");
        for (const weight of [400, 500, 600, 700, 800]) {
          await page.evaluate(async (weight) => {
            const probe = document.createElement("span");
            probe.id = "cairo-font-probe";
            probe.dataset.i18n = "declarative";
            probe.textContent = "ChronicCare العربية 120/80";
            probe.style.cssText = `position:fixed;top:0;opacity:0;pointer-events:none;font-family:Cairo;font-weight:${weight}`;
            document.body.append(probe);
            await document.fonts.load(`${weight} 16px Cairo`, probe.textContent);
            await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
          }, weight);
          const { root } = await cdp.send("DOM.getDocument");
          const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: "#cairo-font-probe" });
          const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
          report.renderedFonts.push({ width, language, ...setting, weight, fonts });
          assert(fonts.length > 0 && fonts.every((font) => font.isCustomFont && font.familyName === "Cairo" && font.glyphCount > 0), "Arabic/Latin/numbers must render with bundled Cairo");
          await page.locator("#cairo-font-probe").evaluate((probe) => probe.remove());
        }
        await cdp.detach();
      }
      const meta = { width, language, ...setting, route };
      const priority = ["/patient/dashboard", "/patient/habits", "/patient/measurements"].includes(route);
      await measure(page, meta, (priority && (setting.mode !== "system" || width === 320)) || (route === "/patient/reports" && [320, 1440].includes(width) && setting.mode === "light"));
      if (priority && (!quick || capture)) {
        if (route === "/patient/dashboard") {
          await page.locator(".chart .recharts-surface").waitFor();
          await page.locator(".segmented button").last().click();
          await measure(page, { ...meta, dialog: "glucose-chart" });
          await page.locator(".chart").scrollIntoViewIfNeeded();
          await page.locator(".chart .recharts-surface").hover({ position: { x: 100, y: 70 } });
          await page.locator(".recharts-tooltip-wrapper").filter({ visible: true }).waitFor();
          if (capture && [320, 1440].includes(width)) await measure(page, { ...meta, dialog: "chart-tooltip" }, true);
          await page.mouse.move(0, 0);
          if (width <= 850) await dialogCheck(page, meta, page.locator(".bottom-nav button").last(), "more-menu");
          await dialogCheck(page, meta, page.locator(".header-actions button").filter({ has: page.locator(".lucide-bell") }), "notifications");
          await dialogCheck(page, meta, page.locator(".add-reading"), "add-reading");
        } else if (route === "/patient/measurements") {
          assert.equal(await page.locator(".measurement-entry").count(), 14);
          await dialogCheck(page, meta, page.locator(".measurements-actions > button"), "add-reading");
          await dialogCheck(page, meta, page.locator(".measurement-entry-actions button").first(), "edit-reading");
          await dialogCheck(page, meta, page.locator(".measurement-entry-actions button").nth(1), "delete-reading");
        } else {
          await dialogCheck(page, meta, page.locator(".habits-actions > button"), "add-habit");
          await dialogCheck(page, meta, page.locator(".habit-detail > button").first(), "habit-progress");
          await dialogCheck(page, meta, page.locator(".medication-card-actions button").first(), "edit-habit");
          await dialogCheck(page, meta, page.locator(".medication-card-actions button").nth(1), "delete-habit");
        }
      }
    }
    if (!quick && [320, 768, 1440].includes(width)) await exerciseInteractions(page, context, { width, language, ...setting });
    console.log(`Measured ${width}px ${language} ${setting.mode}/${setting.os}; issues so far: ${report.issues.length}`);
    await context.close();
  }
} catch (error) {
  report.failure = { message: error.message, url: activePage?.url() };
  if (activePage && !activePage.isClosed()) {
    await activePage.screenshot({ path: join(output, "failure.png"), fullPage: true });
    report.failure.state = await activePage.evaluate(() => ({ width: innerWidth, height: innerHeight, dialogs: [...document.querySelectorAll("dialog[open]")].map((dialog) => dialog.innerText), bottomNav: getComputedStyle(document.querySelector(".bottom-nav") ?? document.body).display }));
  }
  throw error;
} finally {
  await writeFile(join(output, "results.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(`${report.cases.length} cases; ${report.issues.length} layout issues; ${report.browserErrors.length} app browser warnings/errors; ${report.externalResourceErrors.length} external font errors. Evidence: ${output}`);
assert.equal(report.issues.length, 0, "Responsive layout regressions: see results.json");
assert.equal(report.browserErrors.length, 0, "Browser warnings/errors: see results.json");
if (verifyFonts) {
  assert.equal(report.externalRequests.length, 0, "Local font rendering must not request external resources");
  assert.equal(report.externalResourceErrors.length, 0);
}
