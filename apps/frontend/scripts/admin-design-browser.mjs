// Focused UI verification with explicit API fixtures. No backend or database writes.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const base = "http://127.0.0.1:5198", api = "http://127.0.0.1:3318/api";
const output = resolve(root, "artifacts/admin-refinement-phase2c", process.argv.includes("--before") ? "before" : "after"); await mkdir(output, { recursive: true });
const report = { checks: [], errors: [], screenshots: [], transport: "Mocked Admin API; no database integration claimed" };
let browser, child, stopped;
try {
  child = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5198", "--strictPort"], { cwd: root, env: { ...process.env, VITE_API_URL: api }, stdio: "ignore" }); stopped = once(child, "exit");
  for (let n = 0; n < 100; n++) { try { await fetch(base); break; } catch { await new Promise(resolve => setTimeout(resolve, 150)); } }
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  await context.addInitScript(() => { localStorage.setItem("cc-language", "en"); localStorage.setItem("cc-theme", "dark"); localStorage.setItem("cc-public-motion", "paused"); });
  const page = await context.newPage(); page.setDefaultTimeout(15_000); page.on("pageerror", error => report.errors.push(error.message));
  let signedIn = false, state = "ready", posts = 0;
  const user = { id: "admin-fixture", name: "Clinic Admin", email: "admin@example.test", role: "admin" };
  const doctors = [{ id: "doctor-one", name: "Dr Samia Nour", email: "samia.nour@example.test", role: "doctor" }, { id: "doctor-two", name: "د. يوسف أحمد", email: "doctor-with-a-long-address@example.test", role: "doctor" }];
  await page.route(api + "/**", async route => {
    const path = new URL(route.request().url()).pathname, method = route.request().method();
    const send = (status, json) => route.fulfill({ status, headers: { "Access-Control-Allow-Origin": base, "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "Content-Type,X-CSRF-Token", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Expose-Headers": "X-Account-ID", "X-Account-ID": user.id }, ...(json ? { json } : {}) });
    if (method === "OPTIONS") return send(204);
    if (path.endsWith("/auth/csrf")) return send(200, { csrfToken: "a".repeat(64) });
    if (path.endsWith("/auth/login")) { signedIn = true; return send(200, { user }); }
    if (path.endsWith("/auth/me")) return signedIn ? send(200, { user }) : send(401, { error: { code: "UNAUTHENTICATED" } });
    if (path.endsWith("/setup")) return send(200, { available: false });
    if (path.endsWith("/admin/doctors")) {
      if (method === "POST") {
        posts++; const data = route.request().postDataJSON(); assert.deepEqual(Object.keys(data).sort(), ["email", "name", "password"]);
        if (doctors.some(doctor => doctor.email === data.email)) return send(409, { error: { code: "ACCOUNT_EXISTS" } });
        await new Promise(resolve => setTimeout(resolve, 200));
        const doctor = { id: "doctor-three", name: data.name, email: data.email, role: "doctor" }; doctors.push(doctor); return send(201, { doctor });
      }
      if (state === "error") return send(503, { error: { code: "UNAVAILABLE" } });
      return send(200, { doctors: state === "empty" ? [] : doctors });
    }
    return send(404, { error: { code: "NOT_FOUND" } });
  });
  await page.goto(base + "/admin/dashboard");
  await page.locator('input[autocomplete="current-password"]').waitFor(); await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[autocomplete="current-password"]').fill("Fixture-only-password42!"); await page.locator('.auth-card button[type="submit"]').click();
  await page.locator(".admin-doctor-card").first().waitFor();
  assert.equal(await page.locator(".living-admin").count(), 1);
  assert.equal(await page.locator(".living-admin").getAttribute("data-motion"), "paused");
  await page.locator('.admin-jump-nav a[href="#admin-create-title"]').click();
  await page.locator('.admin-create-card button[type="submit"]').click(); assert.equal(await page.locator('[aria-invalid="true"]').count(), 3); assert.equal(posts, 0);
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-invalid") === "true");
  await page.locator('.admin-create-card input[autocomplete="name"]').fill("Dr Lina Test"); await page.locator('.admin-create-card input[type="email"]').fill("lina@example.test");
  await page.locator("#admin-doctor-password").fill("Fixture-only-password42!"); await page.locator('.admin-create-card input[autocomplete="new-password"]').last().fill("Fixture-only-password42!");
  await page.locator(".password-toggle").click(); assert.equal(await page.locator("#admin-doctor-password").getAttribute("type"), "text"); await page.locator(".password-toggle").click();
  await page.locator('.admin-create-card button[type="submit"]').click(); await page.locator(".admin-create-card fieldset[disabled]").waitFor();
  await page.locator(".ui-feedback-success").waitFor(); await page.getByRole("heading", { name: "Dr Lina Test", exact: true }).waitFor(); assert.equal(posts, 1);
  const shot = async name => { await page.evaluate(() => { scrollTo(0, 0); document.activeElement?.blur(); }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); const path = resolve(output, name); await page.screenshot({ path, fullPage: true, animations: "disabled" }); report.screenshots.push(path); };
  assert.equal(await page.locator("html").getAttribute("dir"), "ltr");
  await page.locator(".language-toggle").click();
  await page.waitForFunction(() => document.documentElement.dir === "rtl");
  await shot("admin-1440-ar-dark.png");
  await page.setViewportSize({ width: 390, height: 844 }); await page.locator(".theme-select").selectOption("light");
  await page.waitForFunction(() => document.documentElement.dir === "rtl" && document.documentElement.dataset.theme === "light"); await shot("admin-390-ar-light.png");
  await page.setViewportSize({ width: 320, height: 844 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  const nameInput = page.locator('.admin-create-card input[autocomplete="name"]'); await nameInput.focus(); await page.keyboard.press("Tab"); assert(await page.locator('.admin-create-card input[type="email"]').evaluate(element => element === document.activeElement));
  state = "empty"; await page.reload(); await page.locator(".ui-feedback-empty").waitFor();
  state = "error"; await page.reload(); await page.locator(".ui-feedback-error").waitFor();
  assert(!await page.locator(".admin-overview dd").first().textContent().then(text => /[0-9٠-٩]/.test(text)));
  state = "ready"; await page.locator('.ui-feedback-error button').click(); await page.locator(".admin-doctor-card").first().waitFor();
  report.checks = ["Admin-only Living shell", "in-page navigation", "validation and first-error focus", "password visibility", "pending and confirmed creation", "unchanged API payload", "list refresh", "English LTR and Arabic RTL desktop dark", "mobile Arabic light RTL", "320px overflow", "keyboard field order", "empty and error/retry states", "reduced motion and Motion Off"];
  assert.deepEqual(report.errors, []); console.log(JSON.stringify({ status: "PASS", checks: report.checks.length, output }));
} catch (error) { report.errors.push(error.message); process.exitCode = 1; console.error(error.message); }
finally { if (browser) await browser.close(); if (child && child.exitCode === null) { child.kill(); await stopped; } await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2)); }
