// Real cookie-session logout and browser history checks with the isolated PostgreSQL runner.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { doctorBrowserFixtures } from './doctor-browser-fixtures.mjs';

const database = new URL(process.env.TEST_DATABASE_URL || 'http://unconfigured');
assert(database.hostname === '127.0.0.1' && /^\/chroniccare_graduation_run_\d+_test$/.test(database.pathname), 'Run with final-postgres.mjs.');
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const output = fileURLToPath(new URL('../artifacts/logout-browser/', import.meta.url));
await mkdir(output, { recursive: true });
const report = { checks: [], screenshots: [], errors: [] };
const password = randomBytes(24).toString('hex');
const patient = `${randomUUID()}@example.test`;
const admin = `${randomUUID()}@example.test`;
const fixtures = await doctorBrowserFixtures({ frontendPort: 5196, backendPort: 3316, emails: [admin, patient], password });
const { base, api } = fixtures;

async function signIn(page) {
  await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type=email]').fill(patient);
  await page.locator('input[autocomplete=current-password]').fill(password);
  await page.locator('.auth-card form button[type=submit]').click();
  await page.waitForURL('**/patient/dashboard');
  await page.locator('.canvas-readings').waitFor();
}

async function verifyControl(page, button, label, tag) {
  await button.waitFor();
  assert.equal(await button.count(), 1);
  assert.equal(await button.innerText(), label);
  assert.equal(await button.locator('svg[aria-hidden=true]').count(), 1);
  await page.evaluate(() => document.fonts.ready);
  const box = await button.boundingBox();
  const viewport = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  assert(box.width >= 44 && box.height >= 44, `${tag}: ${box.width}×${box.height}`);
  assert(box.x >= 0 && box.x + box.width <= viewport.width + 1 && viewport.scroll <= viewport.width + 1, `${tag}: header must fit`);
  await button.click({ trial: true });
  await button.press('Tab');
  await page.keyboard.press('Shift+Tab');
  assert(await button.evaluate(el => el === document.activeElement && getComputedStyle(el).outlineWidth === '3px'));
  const screenshot = resolve(output, `${tag}.png`);
  await page.screenshot({ path: screenshot });
  report.screenshots.push(screenshot);
  return { width: box.width, height: box.height };
}

async function signOut(page, context, button) {
  const activeCookie = (await context.cookies(api)).find(cookie => cookie.name === 'cc_session');
  assert(activeCookie?.httpOnly, 'Expected the real HTTP-only session cookie');
  const headers = { Cookie: `${activeCookie.name}=${activeCookie.value}` };
  assert.equal((await fetch(`${api}/auth/me`, { headers })).status, 200);
  const response = page.waitForResponse(res => res.url() === `${api}/auth/logout` && res.request().method() === 'POST');
  await button.press('Enter');
  assert.equal((await response).status(), 204);
  await page.waitForURL(url => url.pathname === '/login');
  assert(!(await context.cookies(api)).some(cookie => cookie.name === activeCookie.name));
  assert.equal((await fetch(`${api}/auth/me`, { headers })).status, 401);
  assert.equal((await fetch(`${api}/measurements`, { headers })).status, 401);
  await page.goBack();
  await page.waitForFunction(() => location.pathname === '/login' && !!document.querySelector('.auth-card form'));
  assert.equal(await page.locator('.experience-patient').count(), 0);
  await page.goto(`${base}/patient/measurements`);
  await page.waitForURL(url => url.pathname === '/login' && url.searchParams.get('returnTo') === '/patient/measurements');
  assert.equal(await page.locator('.experience-patient').count(), 0);
}

let browser;
try {
  await fixtures.start(admin);
  assert.equal((await fixtures.request('/auth/register', { body: { name: 'Browser fixture', email: patient, password } })).status, 201);
  browser = await chromium.launch({ channel: 'msedge', headless: true, ignoreDefaultArgs: ['--disable-back-forward-cache'] });
  for (const language of ['ar', 'en']) for (const theme of ['light', 'dark']) {
    const label = language === 'ar' ? 'تسجيل الخروج' : 'Sign out';
    const context = await browser.newContext({ viewport: { width: 320, height: 800 }, reducedMotion: 'reduce' });
    try {
      await context.addInitScript(({ language, theme, base }) => {
        if (location.origin !== base) return;
        localStorage.setItem('cc-language', language);
        localStorage.setItem('cc-theme', theme);
      }, { language, theme, base });
      const page = await context.newPage();
      page.on('pageerror', error => report.errors.push(error.message));
      for (const surface of ['dashboard', 'home']) {
        await signIn(page);
        if (surface === 'dashboard') {
          await page.locator('.bottom-nav a[href="/patient/measurements"]').click();
          await page.waitForURL('**/patient/measurements');
          await page.locator('.bottom-nav a[href="/patient/dashboard"]').click();
          await page.waitForURL('**/patient/dashboard');
        } else {
          await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
        }
        const header = page.locator(surface === 'home' ? '.hero-header' : '.app-header');
        const button = header.getByRole('button', { name: label, exact: true });
        for (const width of [1440, 320]) {
          await page.setViewportSize({ width, height: 800 });
          const tag = `${surface}-${language}-${theme}-${width}`;
          const dimensions = await verifyControl(page, button, label, tag);
          report.checks.push({ tag, ...dimensions });
        }
        assert.equal(await page.locator('html').getAttribute('dir'), language === 'ar' ? 'rtl' : 'ltr');
        assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
        await signOut(page, context, button);
        report.checks.push({ tag: `${surface}-${language}-${theme}-logout`, status: '204 and session cookie cleared; previous cookie rejected; Back and direct protected routes guarded' });
      }
      await page.goto(`${base}/`);
      await page.locator('.nav-actions a[href="/register"]').waitFor();
      assert.equal(await page.getByRole('button', { name: label, exact: true }).count(), 0);
    } finally {
      await context.close();
    }
  }
  assert.equal(report.errors.length, 0);
  console.log(`PASS: ${report.checks.length} checks and ${report.screenshots.length} screenshots with the real Express session.`);
} catch (error) {
  report.errors.push(String(error.message).replaceAll(password, '[redacted]').replaceAll(patient, '[redacted]').replaceAll(admin, '[redacted]'));
  console.error(report.errors.at(-1));
  process.exitCode = 1;
} finally {
  await browser?.close();
  await fixtures.close();
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
}
