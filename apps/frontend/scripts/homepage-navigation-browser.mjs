
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const base = process.env.HOMEPAGE_BASE_URL || "http://127.0.0.1:4317";
const output = resolve(process.env.HOMEPAGE_OUTPUT || "artifacts/homepage-navigation");
const report = { source: "Mocked API responses. No database or external service calls.", cases: [], errors: [] };
const labels = {
  ar: { guest: "ادخل مساحة المتابعة", patient: "متابعتي", doctor: "لوحة الطبيب", admin: "لوحة الإدارة" },
  en: { guest: "Enter your health space", patient: "My care", doctor: "Doctor dashboard", admin: "Admin dashboard" },
};

async function fixture(browser, role, language, theme) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  await context.addInitScript(({ language, theme }) => {
    if (!localStorage.getItem("cc-language")) localStorage.setItem("cc-language", language);
    if (!localStorage.getItem("cc-theme")) localStorage.setItem("cc-theme", theme);
  }, { language, theme });
  const user = role === "guest" ? null : { id: "navigation-" + role, role, name: "Navigation fixture", email: role + "@example.test" };
  const headers = {
    "access-control-allow-origin": new URL(base).origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "authorization, content-type, x-csrf-token",
    "access-control-expose-headers": "x-account-id",
    ...(user ? { "x-account-id": user.id } : {}),
  };
  await context.route(/^https?:\/\/[^/]+\/api\//, route => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    const send = (json, status = 200) => route.fulfill({ headers, status, json });
    if (route.request().method() === "OPTIONS") return route.fulfill({ headers, status: 204 });
    if (path === "/auth/me") return user ? send({ user, token: "navigation-fixture-token", expiresAt: new Date(Date.now() + 3600000).toISOString() }) : send({ error: { code: "UNAUTHENTICATED" } }, 401);
    if (path === "/setup") return send({ available: false });
    if (path === "/measurements") return send({ measurements: [] });
    if (path === "/medications") return send({ medications: [] });
    if (path === "/habits") return send({ habits: [] });
    if (path === "/doctor/patients") return send({ patients: [] });
    if (path === "/admin/doctors") return send({ doctors: [] });
    return send({ error: { code: "NOT_FOUND" } }, 404);
  });
  const page = await context.newPage();
  page.on("pageerror", error => report.errors.push(error.message));
  return { context, page };
}

async function ready(page) {
  await page.locator(".nav-actions a.fh-cta").waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(100);
}

async function checkHeader(page, role, language, theme, width) {
  await page.setViewportSize({ width, height: 1000 });
  await ready(page);
  const nav = page.locator(".hy-nav");
  const compact = await nav.getAttribute("data-layout") === "compact";
  const href = role === "guest" ? "/login" : "/" + role + "/dashboard";
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width, "Header must fit the CSS viewport");
  if (width === 1440) assert.equal(compact, false, "Wide navigation fits inline");
  if (width === 320 || width === 390) assert.equal(compact, true, "Narrow navigation uses the menu");
  if (width === 1280 && language === "ar" && role === "guest") assert.equal(compact, false, "Arabic links remain inline when space is available");

  assert.equal(await nav.locator(".nav-links").isVisible(), !compact);
  if (role === "guest") assert.equal(await nav.locator(".hy-login").isVisible(), !compact);
  else assert.equal(await nav.locator(".fh-cta").getAttribute("href"), href);

  const menuButton = page.locator("#hy-menu-button");
  await menuButton.press("Enter");
  const menu = page.locator("#hy-menu");
  assert.equal(await menuButton.getAttribute("aria-expanded"), "true");
  for (const section of ["readings", "showcase", "journey", "assistant"]) {
    const link = menu.locator('a[href="#' + section + '"]');
    assert.ok(await link.isVisible(), "Every section remains reachable");
    assert.equal(await page.locator("#" + section).count(), 1);
  }
  const workspace = menu.locator(".menu-workspace");
  assert.ok(await workspace.isVisible(), "Workspace remains reachable for every role");
  assert.equal(await workspace.getAttribute("href"), href);
  assert.equal(await workspace.innerText(), labels[language][role]);
  if (role === "guest") assert.ok(await menu.locator('a[href="/register"]').isVisible());
  await page.keyboard.press("Escape");
  assert.equal(await menuButton.getAttribute("aria-expanded"), "false");
  assert.ok(await menuButton.evaluate(element => element === document.activeElement));
  assert.equal(await menuButton.evaluate(element => getComputedStyle(element).outlineWidth), "3px");
  report.cases.push({ role, language, theme, width, compact, href });
}

await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "msedge", headless: true });
try {
  for (const language of ["ar", "en"]) {
    for (const theme of ["light", "dark"]) {
      for (const role of ["guest", "patient", "doctor", "admin"]) {
        const { context, page } = await fixture(browser, role, language, theme);
        try {
          await page.goto(base + "/", {waitUntil:"domcontentloaded",timeout:60_000});
          for (const width of [1440, 1280, 1024, 768, 390, 320]) await checkHeader(page, role, language, theme, width);
          await page.setViewportSize({ width: 1440, height: 1000 });
          await ready(page);
          await page.locator(".nav-links a").first().focus();
          await page.setViewportSize({ width: 320, height: 1000 });
          await page.waitForFunction(() => document.querySelector(".hy-nav").dataset.layout === "compact");
          assert.ok(await page.locator("#hy-menu-button").evaluate(element => element === document.activeElement), "Collapsing focused inline links preserves keyboard focus");

          await page.locator("#hy-menu-button").press("Enter");
          await page.locator('#hy-menu a[href="#assistant"]').press("Enter");
          assert.equal(await page.locator("#hy-menu-button").getAttribute("aria-expanded"), "false");
          assert.ok(await page.locator("#assistant").evaluate(element => element === document.activeElement));

          await page.locator("#hy-menu-button").press("Enter");
          await page.locator("#hy-menu .menu-workspace").press("Enter");
          await page.waitForURL("**" + (role === "guest" ? "/login" : "/" + role + "/dashboard"));
          await page.locator("h1").first().waitFor();
          if (role === "guest") await page.locator('input[type="email"]').waitFor();
          if (role === "guest") {
            await page.goto(base + "/#features");
            await page.evaluate(() => document.fonts.ready);
            await page.waitForFunction(() => document.querySelector("#showcase")?.getBoundingClientRect().top < 100);
          }

        } finally { await context.close(); }
      }
    }
  }
  assert.deepEqual(report.errors, []);
  console.log("PASS: " + report.cases.length + " header cases, every role destination, breakpoint focus and keyboard section navigation.");
} finally {
  await browser.close();
  await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2));
}

