// Dashboard-only browser verification. Demo entry uses the existing AuthProvider;
// no database, environment secrets, backend fixtures or patient endpoints are used.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const root = fileURLToPath(new URL('..', import.meta.url));
const before = process.argv.includes('--before'), output = resolve(root, 'artifacts/phase1e', before ? 'before' : 'after');
await mkdir(output, { recursive: true });
const services = [], report = { cases: [], errors: [], checks: [], backendRequests: [] };
let browser;
const base = 'http://127.0.0.1:5181';
async function navigate(page, path) {
  await page.evaluate(async path => { const { router } = await import('/src/app/router.tsx'); await router.navigate(path); }, path);
  await page.waitForFunction(expected => Boolean(document.querySelector('.living-dashboard')) === expected, ['/patient/dashboard', '/patient/measurements', '/patient/medications', '/patient/habits', '/patient/reports'].includes(path.split(/[?#]/)[0]));
  await page.locator('h1').waitFor();
}
async function interactionChecks(language, width) {
  const context = await browser.newContext({ viewport: { width, height: 960 }, reducedMotion: 'no-preference' });
  try {
    await context.addInitScript(language => { localStorage.setItem('cc-language', language); localStorage.setItem('cc-theme', 'light'); localStorage.setItem('cc-public-motion', 'running'); }, language);
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', message => { if (['error', 'warning'].includes(message.type())) report.errors.push(message.text()); });
    page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) report.backendRequests.push(new URL(request.url()).pathname); });
    await page.goto(`${base}/login`); await page.locator('.auth-card > .btn-secondary').click();
    await navigate(page, '/patient/dashboard?phase=1e#main');
    await page.locator('.weekly-section .recharts-surface').waitFor();
    const url = page.url();
    for (let i = 0; i < 6; i++) {
      await page.locator('.language-toggle').click();
      assert.equal(page.url(), url);
      assert.equal(await page.locator('html').getAttribute('dir'), i % 2 === 0 ? language === 'ar' ? 'ltr' : 'rtl' : language === 'ar' ? 'rtl' : 'ltr');
    }
    const motion = page.locator('.motion-toggle');
    await motion.click(); assert.equal(await page.locator('.living-dashboard').getAttribute('data-motion'), 'paused');
    assert.equal(await page.evaluate(() => localStorage.getItem('cc-public-motion')), 'paused');
    await motion.click(); assert.equal(await page.locator('.living-dashboard').getAttribute('data-motion'), 'running');
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForFunction(() => document.querySelector('.living-dashboard').dataset.motion === 'paused');
    assert(await motion.isDisabled());
    await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.waitForFunction(() => document.querySelector('.living-dashboard').dataset.motion === 'running');
    for (const mode of ['dark', 'light', 'system']) {
      await page.locator('.theme-select').selectOption(mode);
      if (mode === 'system') for (const os of ['dark', 'light']) {
        await page.emulateMedia({ colorScheme: os }); await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, os);
      }
      assert.equal(await page.evaluate(() => localStorage.getItem('cc-theme')), mode);
    }
    await page.locator('.skip-link').focus(); await page.keyboard.press('Enter');
    assert.equal(page.url(), url); assert(await page.locator('main').evaluate(node => node === document.activeElement));
    await page.locator('.segmented button').last().click();
    assert.equal(await page.locator('.weekly-section').getAttribute('data-kind'), 'glucose');
    await page.locator('.chart .recharts-surface').hover({ position: { x: 100, y: 80 } });
    await page.locator('.recharts-tooltip-wrapper').filter({ visible: true }).waitFor();
    assert.match(await page.locator('.recharts-tooltip-wrapper').innerText(), language === 'ar' ? /السكر/ : /Glucose/);
    await page.locator('.segmented button').first().click();
    await page.locator('.chart-data summary').click(); assert.equal(await page.locator('.chart-data li').count(), 7);
    await page.locator('.dashboard-assistant summary').focus(); await page.keyboard.press('Enter');
    assert(await page.locator('.dashboard-assistant a').isVisible()); await page.keyboard.press('Enter');
    await page.locator('.add-reading').click(); await page.keyboard.press('Escape');
    await page.locator('dialog[open]').waitFor({ state: 'hidden' });
    assert(await page.locator('.add-reading').evaluate(node => node === document.activeElement));
    await page.locator('.add-reading').click(); await page.locator('dialog[open] button[type=submit]').click();
    await page.locator('dialog[open] [aria-invalid=true]').first().waitFor();
    await page.locator('dialog[open] input[name=systolic]').fill('125');
    await page.locator('dialog[open] input[name=diastolic]').fill('85');
    await page.locator('dialog[open] button[type=submit]').click(); await page.locator('dialog[open]').waitFor({ state: 'hidden' });
    await page.waitForFunction(() => document.querySelector('.metric-number')?.textContent.trim() === '125/85');
    await page.locator('.language-toggle').click(); await page.locator('.language-toggle').click();
    assert.equal((await page.locator('.metric-number').first().innerText()).trim(), '125/85');
    await page.locator('.dashboard-medication .task-row button').click();
    await page.waitForFunction(() => document.querySelector('.dashboard-medication .dashboard-routine-progress strong')?.textContent === '3/3');
    await navigate(page, '/patient/medications');
    assert.equal(await page.locator('.living-medications').count(), 1, 'Medications reuse the approved Living shell');
    const dose = page.locator('.dose-list li').filter({ hasText: '20:00' }).locator('button[aria-pressed=true]').first();
    await dose.click(); await navigate(page, '/patient/dashboard');
    await page.waitForFunction(() => document.querySelector('.dashboard-medication .dashboard-routine-progress strong')?.textContent === '2/3');
    await page.locator('.dashboard-habits .task-row a').last().click();
    const water = page.locator('.habit-detail').filter({ has: page.getByRole('heading', { name: language === 'ar' ? 'شرب الماء' : 'Drink water', exact: true }) });
    await water.locator(':scope > button').click(); await page.locator('dialog[open] input[type=number]').fill('7');
    await page.locator('dialog[open] button[type=submit]').click(); await page.locator('dialog[open]').waitFor({ state: 'hidden' });
    await navigate(page, '/patient/dashboard');
    await page.waitForFunction(() => [...document.querySelectorAll('.dashboard-habits .task-copy p')].some(node => /7.*8/.test(node.textContent)));
    await page.locator('.dashboard-report').click(); await page.locator('.report-readings').waitFor(); assert.match(await page.locator('.report-readings').innerText(), /125\/85/);
    await navigate(page, '/patient/measurements'); await page.locator('.measurement-entry').first().waitFor(); assert.equal(await page.locator('.measurement-entry').count(), 15);
    await navigate(page, '/patient/dashboard'); await page.locator('.weekly-section .recharts-surface').waitFor();
    if (width < 950) {
      await page.locator('.bottom-nav button').last().click();
      await page.locator('dialog[open] a[href="/patient/reports"]').click(); await page.waitForURL('**/patient/reports');
      await navigate(page, '/patient/dashboard');
    }
    // Native keyboard scrolling must keep focused controls above the fixed mobile bar.
    await page.locator('.skip-link').focus();
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const focus = await page.evaluate(() => {
        const el = document.activeElement, r = el.getBoundingClientRect(), nav = document.querySelector('.bottom-nav'), bar = nav.getBoundingClientRect();
        return { obscured: !el.closest('.bottom-nav') && bar.height > 0 && r.bottom > bar.top + 1 && r.top < innerHeight && r.height > 0, name: el.getAttribute('aria-label') || el.textContent.slice(0, 70) };
      });
      assert(!focus.obscured, `Focused element obscured: ${focus.name}`);
    }
    report.checks.push({ language, width, status: 'PASS', checks: ['6 language switches preserve route/query/hash', 'theme and system OS preferences', 'motion off and reduced motion', 'skip link and focus return', 'chart switch/tooltip/7-day ledger', 'measurement validation/add/dashboard/report synchronization', 'dose save and undo', 'habit progress and dashboard synchronization', 'More navigation', '40 keyboard focus steps', 'non-dashboard scope isolation'] });
  } finally { await context.close(); }
}
async function start(args, cwd, port) {
  const probe = createServer();
  await new Promise((yes, no) => { probe.once('error', no); probe.listen(port, '127.0.0.1', yes); });
  await new Promise(yes => probe.close(yes));
  const child = spawn(process.execPath, args, { cwd, stdio: 'ignore' });
  services.push({ child, stopped: once(child, 'exit') });
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`http://127.0.0.1:${port}`)).ok) return; } catch { /* Startup only. */ }
    await new Promise(yes => setTimeout(yes, 250));
  }
  throw Error(`Preview ${port} did not start`);
}
try {
  await start(['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5181', '--strictPort'], root, 5181);
  await start(['scripts/motion-preview.mjs'], resolve(root, '../../design-prototypes/chroniccare-living'), 5206);
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  report.browser = browser.version();
  for (const width of process.argv.includes('--interactions-only') ? [] : [1440, 768, 390, 320]) for (const language of ['ar', 'en']) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 960 : width === 768 ? 1024 : 844 }, reducedMotion: 'reduce' });
    await context.addInitScript(({ language, theme }) => { localStorage.setItem('cc-language', language); localStorage.setItem('cc-theme', theme); localStorage.setItem('cc-living-language', language); localStorage.setItem('cc-living-theme', theme); }, { language, theme });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', message => { if (['error', 'warning'].includes(message.type())) report.errors.push(message.text()); });
    page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) report.backendRequests.push(new URL(request.url()).pathname); });
    await page.goto('http://127.0.0.1:5181/login');
    await page.locator('.auth-card > .btn-secondary').click(); await page.waitForURL('**/patient/dashboard');
    await page.locator('.weekly-section .recharts-surface').waitFor(); await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => window.scrollTo(0, 0)); await page.mouse.move(0, 0);
    await page.waitForTimeout(250);
    const geometry = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth, direction: document.documentElement.dir, theme: document.documentElement.dataset.theme, hiddenOverflow: [document.body, document.documentElement].some(node => ['hidden', 'clip'].includes(getComputedStyle(node).overflowX)), containers: [...document.querySelectorAll('.dashboard-metrics,.metric-card,.section-heading,.header-actions,.dashboard-routine,.dashboard-support,.task-copy')].filter(node => node.clientWidth > 0 && node.scrollWidth > node.clientWidth + 1).map(node => node.className), fontLoaded: document.fonts.check('16px Cairo') }));
    if (!before) { assert(geometry.overflow <= 1); assert(!geometry.hiddenOverflow); assert.deepEqual(geometry.containers, []); assert(geometry.fontLoaded); assert.equal(geometry.direction, language === 'ar' ? 'rtl' : 'ltr'); assert.equal(geometry.theme, theme); }
    await page.screenshot({ path: resolve(output, `dashboard-${width}-${language}-${theme}.png`), fullPage: true });
    report.cases.push({ width, language, theme, ...geometry });
    await page.goto('http://127.0.0.1:5206/#dashboard'); await page.locator('.dashboard-experience').waitFor(); await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: resolve(output, `reference-${width}-${language}-${theme}.png`), fullPage: true });
    await context.close();
  }
  if (!before) for (const language of ['ar', 'en']) for (const width of [320, 1440]) await interactionChecks(language, width);
  assert.deepEqual(report.errors, []); assert.deepEqual(report.backendRequests, []);
} finally {
  if (browser) await browser.close();
  for (const service of services.reverse()) { service.child.kill(); await service.stopped; }
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
}
console.log(`PASS ${report.cases.length} dashboard cases; no backend requests`);
