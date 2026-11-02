// Frontend integration with explicit mocked backend responses. No LLM/database calls.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const base = "http://127.0.0.1:5194", api = "http://127.0.0.1:3314/api";
const output = resolve(root, "artifacts/assistant-frontend"); await mkdir(output, { recursive: true });
const report = { checks: [], errors: [], screenshots: [], source: "Mocked backend fixtures; no paid OpenAI or database requests" };
let child, stopped, browser, stage = "startup";
try {
  child = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5194", "--strictPort"], { cwd: root, env: { ...process.env, VITE_API_URL: api }, stdio: "ignore" }); stopped = once(child, "exit");
  for (let n = 0; n < 100; n++) { try { await fetch(base); break; } catch { await new Promise(resolve => setTimeout(resolve, 150)); } }
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  await context.addInitScript(() => { localStorage.setItem("cc-language", "en"); localStorage.setItem("cc-theme", "dark"); localStorage.setItem("cc-public-motion", "paused"); });
  await context.route("https://api.openai.com/**", route => { report.errors.push("Unexpected direct provider request"); return route.abort(); });
  const page = await context.newPage(); page.setDefaultTimeout(15_000); page.on("pageerror", error => report.errors.push(error.message));
  let signedIn = true, role = "patient", mode = "hold", release;
  let hold = new Promise(resolve => { release = resolve; });
  const calls = [];
  let markFirstCall;
  const firstCall = new Promise(resolve => { markFirstCall = resolve; });
  await page.route(api + "/**", async route => {
    const path = new URL(route.request().url()).pathname, method = route.request().method();
    const user = { id: role + "-fixture", name: "Test account", email: "fixture@example.test", role };
    const send = (status, json) => route.fulfill({ status, headers: { "Access-Control-Allow-Origin": base, "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "Content-Type,X-CSRF-Token", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Expose-Headers": "X-Account-ID", "X-Account-ID": user.id }, ...(json ? { json } : {}) });
    if (method === "OPTIONS") return send(204);
    if (path.endsWith("/auth/csrf")) return send(200, { csrfToken: "a".repeat(64) });
    if (path.endsWith("/auth/me")) return signedIn ? send(200, { user }) : send(401, { error: { code: "UNAUTHENTICATED" } });
    if (path.endsWith("/auth/login")) { signedIn = true; role = "patient"; return send(200, { user: { ...user, id: "patient-fixture", role } }); }
    if (path.endsWith("/setup")) return send(200, { available: false });
    if (path.endsWith("/doctor/patients")) return send(200, { patients: [] });
    if (path.endsWith("/admin/doctors")) return send(200, { doctors: [] });
    if (path.endsWith("/assistant/messages")) {
      const input = route.request().postDataJSON(); calls.push(input); markFirstCall();
      assert.deepEqual(Object.keys(input).sort(), ["language", "message"]); assert(input.message.length <= 2000);
      assert.equal(route.request().headers()["x-csrf-token"], "a".repeat(64));
      const current = mode;
      if (current === "hold" || current === "long-hold") await hold;
      if (current === "network") return route.abort("failed");
      if (current === "UNAUTHENTICATED") { signedIn = false; return send(401, { error: { code: current } }); }
      const errors = { ASSISTANT_NOT_CONFIGURED: 503, ASSISTANT_TIMEOUT: 504, ASSISTANT_RATE_LIMITED: 429, ASSISTANT_BUSY: 429, ASSISTANT_PROVIDER_ERROR: 502, ASSISTANT_REFUSED: 422 };
      if (errors[current]) return send(errors[current], { error: { code: current } });
      if (current === "malformed") return send(200, { data: { reply: "Do not show this invalid reply" } });
      return send(200, { data: { language: input.language,
        reply: current === "html" ? '<img src=x onerror="window.assistantXss=true">' : current === "long-hold" ? "Long fixture answer for reading and scroll verification. ".repeat(65) : input.language === "ar" ? "إجابة اختبارية: اسأل مختصًا مؤهلًا عن النصائح الفردية، واستخدم المساعد لفهم المعلومات العامة." : "Test fixture: General health education helps explain health terminology and everyday routines. Ask a qualified professional for individual advice.",
        disclaimer: input.language === "ar" ? "تنبيه من الخادم الاختباري: معلومات تعليمية وليست تشخيصًا أو وصفة." : "Server fixture disclaimer: educational information, not diagnosis or prescription.",
        emergencyGuidance: input.language === "ar" ? "إرشاد الخادم الاختباري: في حالة الخطر اتصل بخدمات الطوارئ المحلية فورًا، ولا تنتظر المساعد." : "Server fixture guidance: contact local emergency services immediately for urgent danger. Do not wait for the assistant.",
      } });
    }
    return send(404, { error: { code: "NOT_FOUND" } });
  });
  await page.goto(base + "/patient/assistant");
  const composer = page.locator("#assistant-message"), submit = page.locator('.assistant-composer button[type="submit"]');
  await composer.waitFor(); assert.equal(calls.length, 0); await page.locator(".assistant-empty").waitFor();
  assert.equal(await composer.getAttribute("maxlength"), "2000"); assert(await submit.isDisabled());
  stage = "pending-and-keyboard";
  await composer.fill("What is health education?"); await composer.press("Shift+Enter"); assert((await composer.inputValue()).includes("\n")); assert.equal(calls.length, 0);
  await composer.press("Enter"); await page.locator('.assistant-log [role="status"]').waitFor();
  assert(await submit.isDisabled()); assert.equal(await composer.getAttribute("readonly"), "");
  await composer.press("Enter"); await firstCall; assert.equal(calls.length, 1); release(); await page.locator(".model-message").waitFor();
  assert.equal(calls.length, 1); assert(calls[0].message.includes("health education")); assert.equal(calls[0].language, "en");
  assert((await page.locator(".assistant-disclaimer").textContent()).includes("Server fixture disclaimer"));
  assert((await page.locator(".assistant-emergency").textContent()).includes("Server fixture guidance"));
  const shot = async name => { await page.evaluate(() => { scrollTo(0, 0); document.activeElement?.blur(); }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); const path = resolve(output, name); await page.screenshot({ path, fullPage: true, animations: "disabled" }); report.screenshots.push(path); };
  await shot("assistant-1440-en-dark.png");
  stage = "safe-text-and-scroll";
  mode = "html"; await composer.fill("Check text rendering"); await composer.press("Enter"); await page.getByText('<img src=x onerror="window.assistantXss=true">', { exact: true }).waitFor();
  assert.equal(await page.locator(".model-message img").count(), 0); assert(!await page.evaluate(() => window.assistantXss));
  mode = "long-hold"; hold = new Promise(resolve => { release = resolve; });
  await composer.fill("A long reading test"); await composer.press("Enter"); await page.locator('.assistant-log [role="status"]').waitFor();
  await page.locator(".assistant-log").evaluate(element => { element.scrollTop = 0; element.dispatchEvent(new Event("scroll")); }); release();
  await page.waitForFunction(() => document.querySelectorAll(".model-message").length === 3);
  assert(await page.locator(".assistant-log").evaluate(element => element.scrollTop < 20));
  await page.locator(".assistant-latest").click(); assert(await page.locator(".assistant-log").evaluate(element => element.scrollTop > 0));
  stage = "clear-errors-explicit-retry";
  const clear = () => page.locator(".assistant-heading button").click();
  for (const code of ["ASSISTANT_NOT_CONFIGURED", "ASSISTANT_TIMEOUT", "ASSISTANT_RATE_LIMITED", "ASSISTANT_BUSY", "ASSISTANT_PROVIDER_ERROR", "ASSISTANT_REFUSED", "malformed", "network"]) {
    await clear(); mode = code; const before = calls.length;
    await composer.fill("Error test " + code); await composer.press("Enter"); await page.locator(".assistant-error").waitFor();
    assert.equal(calls.length, before + 1); assert.equal(await page.locator(".model-message").count(), 0);
    mode = "success"; await page.locator(".assistant-error button").click(); await page.locator(".model-message").waitFor();
    assert.equal(calls.length, before + 2); assert.equal(await page.locator(".patient-message").count(), 1);
  }
  stage = "mobile-arabic-and-memory";
  await clear(); await page.locator(".language-toggle").click(); await page.locator(".theme-select").selectOption("light");
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForFunction(() => document.documentElement.dir === "rtl" && document.documentElement.dataset.theme === "light");
  mode = "success"; await composer.fill("كيف أفهم المعلومات الصحية العامة؟"); await submit.click(); await page.locator(".model-message").waitFor();
  assert.equal(calls.at(-1).language, "ar"); await shot("assistant-390-ar-light.png");
  await page.setViewportSize({ width: 320, height: 844 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.locator(".theme-select").selectOption("system"); await page.emulateMedia({ colorScheme: "dark" }); await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
  assert.equal(await page.locator(".living-assistant").getAttribute("data-motion"), "paused");
  assert(await page.evaluate(() => !JSON.stringify({ ...localStorage, ...sessionStorage }).includes("كيف أفهم")));
  const beforeReload = calls.length; await page.reload(); await page.locator(".assistant-empty").waitFor(); assert.equal(calls.length, beforeReload);
  await composer.fill("x".repeat(2000)); assert.equal((await composer.inputValue()).length, 2000); await clear();
  stage = "expiry-and-role-guards";
  mode = "UNAUTHENTICATED"; await composer.fill("Expiry test"); await composer.press("Enter"); await page.waitForURL("**/login?returnTo=*"); assert.equal(await page.locator(".assistant-page").count(), 0);
  for (const nextRole of ["doctor", "admin"]) { signedIn = true; role = nextRole; await page.goto(base + "/patient/assistant"); await page.waitForURL(`**/${nextRole}/dashboard`); assert.equal(await page.locator(".assistant-page").count(), 0); }
  report.checks = ["Patient-only route and role redirects", "empty state without a request", "2000-character composer", "Enter/Shift+Enter", "pending duplicate lock", "authenticated CSRF API payload", "backend disclaimer/emergency text", "plain text and XSS safety", "manual scroll preserved and latest-message action", "8 failure states and explicit-only retries", "retry does not duplicate patient bubble", "new conversation clears memory", "English LTR desktop dark", "Arabic RTL mobile light and 320px", "System theme and reduced motion/Motion Off", "reload has no conversation persistence or automatic requests", "session expiry clears the page", "no direct OpenAI requests"];
  assert.deepEqual(report.errors, []); console.log(JSON.stringify({ status: "PASS", checks: report.checks.length, output }));
} catch (error) { report.errors.push({ stage, message: error.message }); console.error(stage + ": " + error.message); process.exitCode = 1; }
finally { if (browser) await browser.close(); if (child && child.exitCode === null) { child.kill(); await stopped; } await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2)); }
