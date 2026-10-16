// Real PostgreSQL + browser verification. Requires the existing dedicated test DB.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomUUID, randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const backend = resolve(root, "../backend");
const require = createRequire(import.meta.url);
const backendRequire = createRequire(resolve(backend, "package.json"));
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const { Client } = backendRequire("pg");
const argon2 = backendRequire("argon2");
const config = parseEnv(await readFile(resolve(backend, ".env"), "utf8"));
const databaseUrl = process.env.TEST_DATABASE_URL || config.TEST_DATABASE_URL;
assert(databaseUrl && new URL(databaseUrl).pathname === "/chroniccare_test", "Only chroniccare_test is permitted");
const db = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
const output = resolve(root, "artifacts/auth");
await mkdir(output, { recursive: true });
const report = { checks: [], screenshots: [], errors: [] };
const accounts = [];
const services = [];
let browser;
function start(args, cwd, env) {
  const child = spawn(process.execPath, args, { cwd, env: { ...process.env, ...env }, stdio: "ignore" });
  const stopped = once(child, "exit");
  services.push({ child, stopped });
}
async function wait(url) {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(url)).ok) return; } catch { /* Wait for startup. */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error("Temporary service did not become ready");
}
async function shot(page, name) {
  const path = resolve(output, `${name}.png`);
  await page.screenshot({ path, fullPage: true }); report.screenshots.push(path);
}
try {
  await db.connect();
  const ledger = await db.query("SELECT version FROM public.chroniccare_schema_migrations ORDER BY version");
  assert(ledger.rows.some(r => r.version === "002"), "Apply existing migrations to test DB first");
  // Refuse to accidentally use another process already listening at these URLs.
  for (const port of [3302, 5176]) {
    const net = await import("node:net"); const probe = net.createServer();
    await new Promise((resolve, reject) => { probe.once("error", reject); probe.listen(port, "127.0.0.1", resolve); });
    await new Promise(resolve => probe.close(resolve));
  }
  start(["dist/server.js"], backend, { ...config, DATABASE_URL: databaseUrl, PORT: "3302", HOST: "127.0.0.1", CORS_ORIGINS: "http://127.0.0.1:5176" });
  start(["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5176", "--strictPort"], root, { VITE_API_URL: "http://127.0.0.1:3302/api" });
  await wait("http://127.0.0.1:3302/api/health/ready"); await wait("http://127.0.0.1:5176");
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "msedge", headless: true });
  for (const language of ["ar", "en"]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    await context.addInitScript(lang => { localStorage.setItem("cc-language", lang); }, language);
    const page = await context.newPage();
    page.on("pageerror", () => report.errors.push("Browser runtime error"));
    for (const route of ["login", "register"]) {
    await page.goto(`http://127.0.0.1:5176/${route}`);
    for (const [mode, os] of [["light", "light"], ["dark", "dark"], ["system", "light"], ["system", "dark"]]) {
      await page.locator(".theme-select").selectOption(mode);
      await page.emulateMedia({ colorScheme: os });
      for (const width of [320, 360, 375, 390, 430, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.evaluate(() => document.fonts.ready);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Auth page overflow");
        assert.equal(await page.locator("html").getAttribute("dir"), language === "ar" ? "rtl" : "ltr");
        assert.equal(await page.locator("html").getAttribute("data-theme"), mode === "system" ? os : mode);
        if (width === 320 || width === 1440) await shot(page, `${route}-${language}-${mode}-${os}-${width}`);
      }
    }
    }
    await page.setViewportSize({ width: 390, height: 900 });
    const email = `${randomUUID()}@example.test`; accounts.push(email);
    const password = randomBytes(20).toString("hex");
    const fields = page.locator(".auth-card input");
    await fields.nth(0).fill("Browser مستخدم"); await fields.nth(1).fill(email);
    await page.locator('.language-toggle').click();
    assert.equal(await fields.nth(0).inputValue(), "Browser مستخدم");
    assert.equal(await fields.nth(1).inputValue(), email);
    await page.locator('.language-toggle').click();
    await fields.nth(2).fill(password); await fields.nth(3).fill("mismatch");
    await page.locator('button[type="submit"]').click();
    await page.locator('[aria-invalid="true"]').first().waitFor();
    await fields.nth(3).fill(password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/login?registered=1");
    // Duplicate registration is reported without losing control of the form.
    await page.locator(".auth-card a").first().click();
    for (const [i, value] of ["Browser مستخدم", email, password, password].entries()) await page.locator(".auth-card input").nth(i).fill(value);
    await page.locator('button[type="submit"]').click(); await page.getByRole("alert").waitFor();
    await page.locator(".auth-card a").first().click();
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[autocomplete="current-password"]').fill("Incorrect-Password123!");
    await page.locator('button[type="submit"]').click(); await page.getByRole("alert").waitFor();
    await page.locator('input[autocomplete="current-password"]').fill(password);
    const logged = page.waitForResponse(r => r.url().endsWith("/auth/login") && r.status() === 200);
    await page.locator('button[type="submit"]').click();
    const token = (await (await logged).json()).token;
    await page.waitForURL("**/patient/dashboard");
    assert(await page.evaluate(token => ![...Object.values(localStorage), ...Object.values(sessionStorage)].includes(token), token), "Token persisted in browser storage");
    await page.evaluate(async () => { const { queryClient } = await import('/src/lib/query/queryClient.ts'); queryClient.setQueryData(['auth-cache-probe'], 'private'); });
    await page.locator('.session-bar button').click(); await page.waitForURL("**/login?returnTo=*");
    assert.equal(await page.evaluate(async () => { const {queryClient} = await import('/src/lib/query/queryClient.ts'); return queryClient.getQueryData(['auth-cache-probe']); }), undefined);
    assert.equal((await fetch("http://127.0.0.1:3302/api/auth/me", { headers: {Authorization:`Bearer ${token}`} })).status, 401);
    // Safe return URL preserves route, query and hash after login.
    await page.goto("http://127.0.0.1:5176/patient/measurements?range=7#history");
    await page.waitForURL("**/login?returnTo=*");
    await page.locator('input[type="email"]').fill(email); await page.locator('input[autocomplete="current-password"]').fill(password);
    await page.locator('button[type="submit"]').click(); await page.waitForURL("**/patient/measurements?range=7#history");
    const u = await db.query("SELECT id FROM chroniccare.users WHERE email=$1", [email]);
    await db.query("DELETE FROM chroniccare.sessions WHERE user_id=$1", [u.rows[0].id]);
    await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await page.waitForURL("**/login?returnTo=*");
    await page.locator('.auth-card > .btn-secondary').click(); await page.waitForURL("**/patient/dashboard");
    await page.reload(); await page.waitForURL("**/login?returnTo=*");
    report.checks.push(`${language}: responsive login/register at 8 widths × light/dark/system-light/system-dark; language switching preserves inputs; validation, register, duplicate, invalid login, login/me, token memory, logout/revocation, cache clearing, return URL, expired session, demo, reload`);
    await context.close();
  }
  for (const role of ["doctor", "admin"]) {
    const email = `${randomUUID()}@example.test`; accounts.push(email);
    const password = randomBytes(20).toString("hex");
    await db.query("INSERT INTO chroniccare.users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5)", [randomUUID(), role, email, await argon2.hash(password), role]);
    const context = await browser.newContext(); const page = await context.newPage();
    await page.goto("http://127.0.0.1:5176/login");
    await page.locator('input[type="email"]').fill(email);await page.locator('input[autocomplete="current-password"]').fill(password);
    await page.locator('button[type="submit"]').click();await page.waitForURL(`**/${role}/dashboard`);
    await page.evaluate(async () => { const { router } = await import('/src/app/router.tsx'); await router.navigate('/patient/dashboard'); });
    await page.waitForURL(`**/${role}/dashboard`);
    await page.locator('.session-bar button').last().click();
    await page.waitForURL("**/login?returnTo=*");
    report.checks.push(`${role}: real login, role destination, logout`);await context.close();
  }
  assert.deepEqual(report.errors, []);
  console.log(JSON.stringify({status:"PASS",checks:report.checks,screenshots:report.screenshots}));
} catch { report.errors.push("Authentication browser verification failed; inspect local UI and rerun."); console.error(report.errors.at(-1));process.exitCode=1; }
finally {
  if(browser) await browser.close();
  for(const service of services.reverse()){service.child.kill();await service.stopped;}
  if(accounts.length) await db.query("DELETE FROM chroniccare.users WHERE email=ANY($1::text[])",[accounts]);
  await db.end();
  await writeFile(resolve(output,"report.json"),JSON.stringify(report,null,2));
}
