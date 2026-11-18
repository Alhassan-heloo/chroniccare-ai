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
const visual = process.argv.find(a => a.startsWith("--public-"));
const output = resolve(root, visual ? `artifacts/public-design/${visual === "--public-baseline" ? "before" : visual === "--public-final" ? "final" : "after"}` : "artifacts/auth");
await mkdir(output, { recursive: true });
const report = { checks: [], screenshots: [], errors: [], requests: [] };
const accounts = [];
const services = [];
let browser;
let stage = "test-database";
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
  await page.evaluate(async () => { await document.fonts.ready; await new Promise(requestAnimationFrame); });
  await page.screenshot({ path, fullPage: true }); report.screenshots.push(path);
}
try {
  await db.connect();
  const ledger = await db.query("SELECT version FROM public.chroniccare_schema_migrations ORDER BY version");
  assert(ledger.rows.some(r => r.version === "002"), "Apply existing migrations to test DB first");
  // Refuse to accidentally use another process already listening at these URLs.
  stage = "isolated-ports";
  for (const port of [3302, 5176]) {
    const net = await import("node:net"); const probe = net.createServer();
    await new Promise((resolve, reject) => { probe.once("error", reject); probe.listen(port, "127.0.0.1", resolve); });
    await new Promise(resolve => probe.close(resolve));
  }
  start(["dist/server.js"], backend, { ...config, DATABASE_URL: databaseUrl, PORT: "3302", HOST: "127.0.0.1", CORS_ORIGINS: "http://127.0.0.1:5176" });
  start(["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5176", "--strictPort"], root, { VITE_API_URL: "http://127.0.0.1:3302/api", CHRONICCARE_VITE_CACHE_DIR: "node_modules/.vite-auth-browser" });
  stage = "backend-readiness";
  await wait("http://127.0.0.1:3302/api/health/ready");
  stage = "frontend-startup";
  await wait("http://127.0.0.1:5176");
  stage = "browser-authentication";
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "msedge", headless: true });
  if (visual) {
    for (const [language, mode, width] of [["ar","light",320],["en","dark",390],["ar","dark",430],["en","light",768],["ar","light",1024],["en","light",1440],["en","light",320],["ar","dark",1440]]) {
      const context = await browser.newContext({ viewport: {width,height:900}, reducedMotion:"reduce" });
      await context.addInitScript(({language,mode})=>{localStorage.setItem('cc-language',language);localStorage.setItem('cc-theme',mode);},{language,mode});
      const page = await context.newPage();page.on('pageerror',()=>report.errors.push('Public page runtime error'));
      for (const route of ['', 'login', 'register']) {
        await page.goto(`http://127.0.0.1:5176/${route}`); await page.locator('h1').waitFor();await page.evaluate(()=>document.fonts.ready);
        await shot(page,`${route||'home'}-${language}-${mode}-${width}`);
        if (visual !== '--public-baseline') {
          assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Public overflow');
          assert.equal(await page.locator('html').getAttribute('dir'),language==='ar'?'rtl':'ltr');
          assert(await page.evaluate(()=>document.fonts.check('16px Cairo')), 'Local Cairo font unavailable');
          assert(await page.evaluate(()=>{
            const luminance=color=>{
              const rgb=color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});
              return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
            };
            const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
            const root=getComputedStyle(document.querySelector('.public-experience'));
            const button=getComputedStyle(document.querySelector('.btn-primary'));
            const story=document.querySelector('.public-auth-story');
            const storyVisible=story && story.getBoundingClientRect().height>0;
            const storyContrast=!storyVisible || ratio(getComputedStyle(story.querySelector('h2 > span')).color,getComputedStyle(story).backgroundColor)>=4.5;
            return ratio(root.color,root.backgroundColor)>=4.5 && ratio(button.color,button.backgroundColor)>=4.5 && storyContrast;
          }), 'Body or primary action contrast below 4.5:1');
          if (route === '') assert(await page.locator('.care-preview').evaluate(el=>el.getBoundingClientRect().height<600),'Product preview unexpectedly stretched');
          assert.equal(await page.locator('header').count(),1);
          assert.equal(await page.locator('.preferences').count(),1);
          assert(await page.locator('.public-masthead a[href="/login"]').isVisible());
          assert(await page.evaluate(()=>[...document.querySelectorAll('.public-experience button, .public-experience select, .public-account-nav a')].every(el=>{
            const r=el.getBoundingClientRect();return r.height>=44 && r.left>=0 && r.right<=innerWidth+1;
          })), 'Clipped or undersized public control');
          await page.keyboard.press('Tab');
          assert(await page.evaluate(()=>document.activeElement!==document.body),'Keyboard focus unavailable');
        }
      }
      report.checks.push(`${language}/${mode}/${width}: home, login, register screenshots and layout`);await context.close();
    }
    // Capture the actual authenticated public navigation, not a mocked context.
    const email=`${randomUUID()}@example.test`;accounts.push(email);const password=randomBytes(20).toString('hex');
    await db.query('INSERT INTO chroniccare.users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5)',[randomUUID(),'Public navigation',email,await argon2.hash(password),'patient']);
    const context=await browser.newContext({viewport:{width:1440,height:900}});const page=await context.newPage();
    await page.goto('http://127.0.0.1:5176/login');await page.locator('input[type=email]').fill(email);await page.locator('input[autocomplete=current-password]').fill(password);
    await page.locator('button[type=submit]').click();await page.waitForURL('**/patient/dashboard');
    assert.equal(await page.locator('.public-experience').count(),0,'Public styles leaked into protected layout');
    await shot(page,'protected-patient-1440');
    await page.evaluate(async()=>{const {router}=await import('/src/app/router.tsx');await router.navigate('/');});
    await page.locator('#home-title').waitFor();
    await shot(page,'home-authenticated-1440');
    if(visual!=='--public-baseline') {
      assert.equal(await page.locator('header a[href="/login"]').count(),0);assert.equal(await page.locator('header a[href="/register"]').count(),0);assert.equal(await page.locator('header').count(),1);assert.equal(await page.locator('.session-bar').count(),0);
      await page.locator('.public-account-nav button').click();
      await page.locator('header a[href="/login"]').waitFor();
      assert.equal(await page.locator('header a[href="/patient/dashboard"]').count(),0);
      report.checks.push('Public logout restores guest actions without duplicate navigation');
    }
    report.checks.push('Authenticated public navigation captured');await context.close();
  } else {
  for (const language of ["ar", "en"]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    await context.addInitScript(lang => { localStorage.setItem("cc-language", lang); }, language);
    const page = await context.newPage();
    page.on("pageerror", () => report.errors.push("Browser runtime error"));
    page.on("response", response => { if (response.url().startsWith("http://127.0.0.1:3302/api/auth/")) report.requests.push({ stage, path: new URL(response.url()).pathname, status: response.status() }); });
    for (const route of ["login", "register"]) {
    await page.goto(`http://127.0.0.1:5176/${route}`);
    for (const [mode, os] of [["light", "light"], ["dark", "dark"], ["system", "light"], ["system", "dark"]]) {
      if (process.argv.includes("--flow-only")) continue;
      await page.locator(".header-preferences-button").click();
      await page.locator(".theme-select").selectOption(mode);
      await page.keyboard.press("Escape");
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
    stage = `${language}: form-validation`;
    const email = `${randomUUID()}@example.test`; accounts.push(email);
    const password = randomBytes(20).toString("hex");
    const fields = page.locator(".auth-card input");
    await page.locator('button[type="submit"]').click();
    await page.locator('[aria-invalid="true"]').first().waitFor();
    assert(await fields.nth(0).evaluate(el=>el===document.activeElement),'Invalid first field not focused');
    await page.locator('.password-toggle').click();
    assert.equal(await fields.nth(2).getAttribute('type'),'text');
    assert.equal(await page.locator('.password-toggle').getAttribute('aria-pressed'),'true');
    await page.locator('.password-toggle').click();
    assert.equal(await fields.nth(2).getAttribute('type'),'password');
    await fields.nth(0).fill("Browser مستخدم"); await fields.nth(1).fill(email);
    await page.locator('.header-preferences-button').click();
    await page.locator('.language-toggle').click();
    await page.keyboard.press('Escape');
    assert.equal(await fields.nth(0).inputValue(), "Browser مستخدم");
    assert.equal(await fields.nth(1).inputValue(), email);
    await page.locator('.header-preferences-button').click();
    await page.locator('.language-toggle').click();
    await page.keyboard.press('Escape');
    await fields.nth(2).fill(password); await fields.nth(3).fill("mismatch");
    await page.locator('button[type="submit"]').click();
    await page.locator('[aria-invalid="true"]').first().waitFor();
    await fields.nth(3).fill(password);
    stage = `${language}: register`;
    const registered = page.waitForResponse(response => response.url().endsWith('/auth/register') && response.status() === 201);
    await page.locator('button[type="submit"]').click();
    assert.equal((await (await registered).json()).user.role, 'patient', 'Public registration creates a patient only');
    await page.waitForURL("**/login?registered=1");
    await page.locator('input[autocomplete="current-password"]').waitFor();
    // Duplicate registration is reported without losing control of the form.
    stage = `${language}: duplicate-account`;
    await page.locator('.auth-card a[href^="/register"]').click();
    await page.locator('input[autocomplete="name"]').waitFor();
    for (const [i, value] of ["Browser مستخدم", email, password, password].entries()) await page.locator(".auth-card input").nth(i).fill(value);
    await page.locator('button[type="submit"]').click(); await page.getByRole("alert").waitFor();
    await page.locator('.auth-card a[href^="/login"]').click();
    await page.locator('input[autocomplete="current-password"]').waitFor();
    await page.locator('input[type="email"]').fill(email);
    stage = `${language}: incorrect-login-fill`;
    await page.locator('input[autocomplete="current-password"]').fill("Incorrect-Password123!");
    stage = `${language}: incorrect-login-submit`;
    await page.locator('button[type="submit"]').click();
    stage = `${language}: incorrect-login-feedback`;
    await page.getByRole("alert").waitFor();
    await page.locator('input[autocomplete="current-password"]').fill(password);
    stage = `${language}: login-me`;
    const logged = page.waitForResponse(r => r.url().endsWith("/auth/login") && r.status() === 200);
    await page.locator('button[type="submit"]').click();
    const session = await (await logged).json();
    assert.equal(session.token, undefined, "The existing API uses cookie sessions, not returned bearer tokens");
    const sessionCookie = (await context.cookies("http://127.0.0.1:3302")).find(cookie => cookie.name === "cc_session" || cookie.name === "__Host-cc_session");
    assert(sessionCookie?.httpOnly, "The real session cookie is HTTP-only");
    await page.waitForURL("**/patient/dashboard");
    assert(await page.evaluate(value => ![...Object.values(localStorage), ...Object.values(sessionStorage)].includes(value), sessionCookie.value), "Session credential persisted in browser storage");
    await page.evaluate(async () => { const { queryClient } = await import('/src/lib/query/queryClient.ts'); queryClient.setQueryData(['auth-cache-probe'], 'private'); });
    await page.locator('.session-bar button').click(); await page.waitForURL("**/login?returnTo=*");
    assert.equal(await page.evaluate(async () => { const {queryClient} = await import('/src/lib/query/queryClient.ts'); return queryClient.getQueryData(['auth-cache-probe']); }), undefined);
    assert.equal((await fetch("http://127.0.0.1:3302/api/auth/me", { headers: { Cookie: sessionCookie.name + "=" + sessionCookie.value } })).status, 401);
    // Safe return URL preserves route, query and hash after login.
    stage = `${language}: protected-return-url`;
    await page.goto("http://127.0.0.1:5176/patient/measurements?range=7#history");
    await page.waitForURL("**/login?returnTo=*");
    await page.locator('input[type="email"]').fill(email); await page.locator('input[autocomplete="current-password"]').fill(password);
    await page.locator('button[type="submit"]').click(); await page.waitForURL("**/patient/measurements?range=7#history");
    const u = await db.query("SELECT id FROM chroniccare.users WHERE email=$1", [email]);
    stage = `${language}: session-expiration`;
    await db.query("DELETE FROM chroniccare.sessions WHERE user_id=$1", [u.rows[0].id]);
    const expiredCheck = page.waitForResponse(r => r.url().endsWith("/auth/me") && r.status() === 401);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    assert.equal((await (await expiredCheck).json()).error?.code, "UNAUTHENTICATED");
    await page.waitForFunction(() => location.pathname === "/login" && new URLSearchParams(location.search).has("returnTo"));
    const expiredKeys = await page.evaluate(async () => { const {queryClient} = await import('/src/lib/query/queryClient.ts'); return queryClient.getQueryCache().getAll().map(query => query.queryKey); });
    assert.equal(expiredKeys.some(key => key[0] === 'patient' || key[0] === 'auth-cache-probe'), false, 'Expired sessions must remove protected cache keys');
    await page.locator('input[type="email"]').fill(email); await page.locator('input[autocomplete="current-password"]').fill(password);
    await page.locator('button[type="submit"]').click(); await page.waitForURL("**/patient/measurements?range=7#history");
    stage = language + ": cookie-session-reload";
    await page.reload(); await page.waitForURL("**/patient/measurements?range=7#history");
    await page.locator(".measurements-heading").waitFor();
    assert.equal(await page.evaluate(() => fetch("http://127.0.0.1:3302/api/auth/me", { credentials: "include" }).then(response => response.status)), 200,
      "The existing HTTP-only cookie session survives reload without storing a bearer token");
    report.checks.push(`${language}: ${process.argv.includes("--flow-only") ? "flow-only (layout matrix skipped)" : "responsive login/register at 8 widths × light/dark/system-light/system-dark"}; language switching preserves inputs; validation, register, duplicate, invalid login, login/me, HTTP-only cookie and no browser-storage credentials, logout/revocation, cache clearing, return URL, expired session, re-login and cookie-session reload`);
    await context.close();
  }
  for (const role of ["doctor", "admin"]) {
    stage = `${role}: role-authorization`;
    const email = `${randomUUID()}@example.test`; accounts.push(email);
    const password = randomBytes(20).toString("hex");
    await db.query("INSERT INTO chroniccare.users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5)", [randomUUID(), role, email, await argon2.hash(password), role]);
    const context = await browser.newContext(); const page = await context.newPage();
    await page.goto("http://127.0.0.1:5176/login");
    await page.locator('input[type="email"]').fill(email);await page.locator('input[autocomplete="current-password"]').fill(password);
    await page.locator('button[type="submit"]').click();await page.waitForURL(`**/${role}/dashboard`);
    await page.evaluate(async () => { const { router } = await import('/src/app/router.tsx'); await router.navigate('/patient/dashboard'); });
    await page.waitForURL(`**/${role}/dashboard`);
    await page.evaluate(async () => { const { router } = await import('/src/app/router.tsx'); await router.navigate('/'); });
    await page.locator('.nav-actions a.fh-cta').waitFor();
    await page.waitForFunction(() => document.querySelector('.nav-actions a.fh-cta')?.getAttribute('href') !== '/register');
    assert.equal(await page.locator('.hero-header a[href="/login"]').count(), 0);
    stage = role + ": homepage-workspace";
    const workspace = page.locator(`.nav-actions a[href="/${role}/dashboard"]`);
    await workspace.click();
    await page.waitForURL(`**/${role}/dashboard`);
    stage = role + ": workspace-logout";
    await page.locator('.session-bar button').click();
    await page.waitForURL("**/login?returnTo=*");
    await page.evaluate(async () => { const { router } = await import('/src/app/router.tsx'); await router.navigate('/'); });
    stage = role + ": guest-homepage-after-logout";
    await page.locator("#hy-menu-button").click();
    await page.locator('#hy-menu a[href="/login"]').waitFor();
    report.checks.push(`${role}: real login, role destination/guard, authenticated public navigation and real public logout`);await context.close();
  }
  }
  assert.deepEqual(report.errors, []);
  console.log(JSON.stringify({status:"PASS",checks:report.checks,screenshots:report.screenshots}));
} catch (cause) { report.errors.push(cause?.code === "ERR_ASSERTION" ? cause.message : `Authentication browser verification failed at ${stage} (${cause?.name || "Error"}). No credentials logged.`); console.error(report.errors.at(-1));process.exitCode=1; }
finally {
  if(browser) await browser.close();
  for(const service of services.reverse()){service.child.kill();await service.stopped;}
  if(accounts.length) await db.query("DELETE FROM chroniccare.users WHERE email=ANY($1::text[])",[accounts]);
  await db.end();
  await writeFile(resolve(output,"report.json"),JSON.stringify(report,null,2));
}
