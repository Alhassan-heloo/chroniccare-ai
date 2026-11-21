// Patient appearance and reflow checks in Edge with synthetic same-origin API fixtures.
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'artifacts/patient-accessibility');
const port = 5194;
const base = `http://127.0.0.1:${port}`;
const sizeKey = 'cc-patient-text-size';
const report = { checks: [], errors: [], targets: [], screenshots: [] };
const now = new Date();
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
const measurements = [
  { id: 'pressure', kind: 'bloodPressure', systolic: 124, diastolic: 79, recordedAt: now.toISOString(), isExample: false },
  { id: 'glucose', kind: 'glucose', value: 108, recordedAt: new Date(now - 86400000).toISOString(), isExample: false },
];
const medications = [{ id: 'medicine', name: 'Fixture medication', dosage: '10 mg', notes: '', doses: [{ time: '08:00', takenOn: null }] }];
const habits = [{ id: 'habit', title: 'Fixture daily walk', unit: 'minutes', target: 30, progress: 15, templateKey: null, recordedOn: today }];

async function fixture(context, { language, theme, role = 'patient', savedSize }) {
  await context.addInitScript(({ language, theme, savedSize, sizeKey, base }) => {
    if (location.origin !== base) return;
    localStorage.setItem('cc-language', language);
    localStorage.setItem('cc-theme', theme);
    if (savedSize) localStorage.setItem(sizeKey, savedSize);
  }, { language, theme, savedSize, sizeKey, base });
  const user = { id: `${role}-fixture`, name: 'Sarah Patient', email: `${role}@example.test`, role };
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.protocol.startsWith('http') && url.origin !== base) return route.abort();
    if (url.origin !== base || !url.pathname.startsWith('/api/')) return route.continue();
    const send = (json, status = 200) => route.fulfill({ status, headers: { 'x-account-id': user.id }, json });
    switch (url.pathname.slice(4)) {
      case '/auth/me': return send({ user });
      case '/auth/csrf': return send({ csrfToken: 'a'.repeat(64) });
      case '/measurements': return send({ measurements });
      case '/medications': return send({ medications });
      case '/habits': return send({ habits });
      case '/notifications': return send({ notifications: [] });
      case '/notifications/unread-count': return send({ unreadCount: 0 });
      case '/doctor/patients': return send({ patients: [] });
      case '/admin/doctors': return send({ doctors: [] });
      case '/admin/invitations': return send({ invitations: [] });
      case '/connections/doctors': return send({ doctors: [] });
      default: return send({ error: { code: 'NOT_FOUND' } }, 404);
    }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(6000);
  page.on('pageerror', error => report.errors.push(error.message));
  return page;
}

async function capture(page, name) {
  const path = resolve(output, `${name}.png`);
  await page.screenshot({ path, timeout: 15000 });
  report.screenshots.push(path);
}

async function fits(page) {
  await page.evaluate(() => document.fonts.ready);
  const geometry = await page.evaluate(() => {
    const dialog = document.querySelector('dialog[open]');
    const areas = dialog ? [dialog] : [...document.querySelectorAll('main, .app-header, .bottom-nav')];
    const outside = [];
    for (const area of areas) {
      for (const element of area.querySelectorAll('h1,h2,h3,p,label,button,select,a,summary,input,textarea, time, .metric-number,.metric-unit')) {
        if (!element.getClientRects().length || element.closest('svg,.recharts-tooltip-wrapper,.sr-only,details:not([open]) > :not(summary)')) continue;
        const rect = element.getBoundingClientRect();
        const edge = dialog?.getBoundingClientRect();
        if (rect.left < (edge?.left ?? 0) - 1 || rect.right > (edge?.right ?? document.documentElement.clientWidth) + 1 ||
            (element.matches('button,a,label,summary') && element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 2)) {
          outside.push(`${element.tagName}.${element.className} [${Math.round(rect.left)}, ${Math.round(rect.right)}] ${element.textContent.trim().slice(0, 50)}`);
        }
      }
    }
    return { size: document.querySelector('.experience-patient')?.getAttribute('data-text-size'), root: getComputedStyle(document.documentElement).fontSize, overflow: document.documentElement.scrollWidth - innerWidth, outside };
  });
  assert(geometry.overflow <= 1 && !geometry.outside.length, JSON.stringify(geometry));
}

async function targets(page, name, selector) {
  const controls = page.locator(selector).filter({ visible: true });
  assert(await controls.count() > 0, `Missing targets for ${selector}`);
  for (const control of await controls.all()) {
    const { width, height } = await control.boundingBox();
    const label = await control.getAttribute('aria-label') || await control.innerText();
    report.targets.push({ name, label, width, height });
    assert(width >= 44 && height >= 44, `${label} measures ${width}×${height}`);
    if (await control.isEnabled()) await control.click({ trial: true });
  }
}

async function check(page, name, run) {
  try {
    await run();
    report.checks.push(name);
    console.log(`PASS ${name}`);
  } catch (error) {
    report.errors.push(`${name}: ${error.message}`);
    console.error(`FAIL ${report.errors.at(-1).split('\n').slice(0, 12).join('\n')}`);
    await capture(page, `${name}-failure`).catch(() => {});
  }
}

const routes = [
  ['dashboard', '.canvas-readings', '.dashboard-record-pressure, .week-days a, .patient-shortcuts a, .canvas-heading .segmented button, .bottom-nav > :is(button, a), .app-header .session-bar button'],
  ['measurements', '.measurement-entry', '.measurements-page .add-reading, .measurement-filter-panel > summary'],
  ['medications', '.dose-action', '.medications-page .btn-primary, .dose-action'],
  ['habits', '.habit-quick-add', '.habits-page .btn-primary, .habit-quick-add, .habit-quick-decrement'],
  ['reports', '.report-stat', '.report-periods button, .reports-page button[aria-expanded]'],
  ['assistant', '.assistant-composer', '.assistant-prompts button, .assistant-composer button'],
  ['profile', '.account-page', '.account-guidance a'],
];

async function openPatientPage(page, path, ready) {
  await page.goto(`${base}/patient/${path}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.locator(ready).first().waitFor();
}

async function checkForms(page, tag, path, size) {
  if (!['measurements', 'habits', 'medications'].includes(path)) return;
  const panel = path === 'measurements' ? '#measurement-add-panel' : 'dialog[open]';
  await page.locator('main .btn-primary').first().click();
  await page.locator(`${panel} form`).waitFor();
  await fits(page);
  await targets(page, `${tag}-${path}-form-${size}`, `${panel} button[type=submit]`);
  await capture(page, `${tag}-${path}-form-320-${size}`);
  if (path !== 'measurements') await page.keyboard.press('Escape');
}

await mkdir(output, { recursive: true });
process.env.VITE_API_URL = `${base}/api`;
const vite = await createServer({ root, cacheDir: resolve(root, 'node_modules/.vite-patient-accessibility'), logLevel: 'error', server: { host: '127.0.0.1', port, strictPort: true } });
await vite.listen();
let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  for (const language of ['ar', 'en']) for (const theme of ['light', 'dark']) {
    const tag = `${language}-${theme}`;
    if (process.env.CC_ACCESSIBILITY_CASE && process.env.CC_ACCESSIBILITY_CASE !== tag) continue;
    const context = await browser.newContext({ viewport: { width: 320, height: 660 }, reducedMotion: 'reduce' });
    const page = await fixture(context, { language, theme });
    const trigger = page.locator('.header-preferences-button');
    const select = page.getByLabel(language === 'ar' ? 'حجم النص' : 'Text size', { exact: true });
    const shell = page.locator('.experience-patient');
    const type = () => shell.evaluate(el => [getComputedStyle(el).fontSize, getComputedStyle(document.documentElement).fontSize]);
    await check(page, `${tag}-preferences`, async () => {
      await openPatientPage(page, 'dashboard', '.canvas-readings');
      assert.deepEqual(await type(), ['16px', '16px']);
      assert.equal(await page.locator('html').getAttribute('dir'), language === 'ar' ? 'rtl' : 'ltr');
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
      assert.equal(await shell.getAttribute('data-motion'), 'paused');
      assert.equal(await page.locator('.dashboard-record-pressure').evaluate(el => getComputedStyle(el).transitionDuration), '0s');
      await trigger.focus();
      await trigger.press('Enter');
      assert.equal(await select.inputValue(), 'normal');
      assert.deepEqual(await select.locator('option').allTextContents(), language === 'ar' ? ['عادي', 'كبير', 'كبير جدًا'] : ['Normal', 'Large', 'Extra Large']);
      await select.focus();
      await select.press('ArrowDown');
      assert.equal(await select.inputValue(), 'large');
      assert.deepEqual(await type(), ['20px', '16px']);
      await select.press('ArrowDown');
      assert.equal(await select.inputValue(), 'extra-large');
      assert.deepEqual(await type(), ['24px', '16px']);
      await fits(page);
      await targets(page, tag, 'dialog[open] select, dialog[open] .dialog-heading button');
      await capture(page, `${tag}-320-preferences-150`);
      await page.keyboard.press('Escape');
      await select.waitFor({ state: 'hidden' });
      assert(await trigger.evaluate(el => el === document.activeElement));
      await page.reload();
      assert.deepEqual(await type(), ['24px', '16px']);
      assert.equal(await page.evaluate(key => localStorage.getItem(key), sizeKey), 'extra-large');
      await trigger.click();
      await select.press('Home');
      assert.deepEqual(await type(), ['16px', '16px']);
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      await fits(page);
      await targets(page, `${tag}-preferences-text200`, 'dialog[open] select, dialog[open] .dialog-heading button');
      await capture(page, `${tag}-320-preferences-text200`);
      await select.press('End');
      await page.keyboard.press('Escape');
    });

    for (const [path, ready, selector] of routes) {
      await check(page, `${tag}-${path}-320`, async () => {
        await openPatientPage(page, path, ready);
        assert.equal(await shell.getAttribute('data-text-size'), 'extra-large');
        await fits(page);
        await targets(page, `${tag}-${path}`, selector);
        await page.evaluate(() => scrollTo(0, 0));
        await capture(page, `${tag}-${path}-320-150`);
        await checkForms(page, tag, path, '150');
        await page.evaluate(key => localStorage.setItem(key, 'normal'), sizeKey);
        await openPatientPage(page, path, ready);
        await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
        assert.deepEqual(await type(), ['32px', '32px']);
        await fits(page);
        await targets(page, `${tag}-${path}-text200`, selector);
        await page.evaluate(() => scrollTo(0, 0));
        await capture(page, `${tag}-${path}-320-text200`);
        await checkForms(page, tag, path, 'text200');
      });
      await page.evaluate(key => localStorage.setItem(key, 'extra-large'), sizeKey);
    }
    await context.close();
  }

  if (!process.env.CC_ACCESSIBILITY_CASE) {
    for (const role of ['doctor', 'admin']) {
      const context = await browser.newContext();
      const page = await fixture(context, { language: 'en', theme: 'dark', role, savedSize: 'extra-large' });
      await check(page, `${role}-isolation`, async () => {
        await page.goto(`${base}/${role}/dashboard`);
        const shell = page.locator(`.experience-${role}`);
        assert.equal(await shell.getAttribute('data-text-size'), null);
        assert.equal(await shell.evaluate(el => getComputedStyle(el).fontSize), '16px');
        await page.locator('.header-preferences-button').click();
        assert.equal(await page.getByLabel('Text size', { exact: true }).count(), 0);
      });
      await context.close();
    }

    const profile = await mkdtemp(join(tmpdir(), 'chroniccare-patient-zoom-'));
    const context = await chromium.launchPersistentContext(profile, { channel: 'msedge', headless: true, viewport: null, reducedMotion: 'reduce', args: ['--window-size=1440,1000'] });
    try {
      const page = await fixture(context, { language: 'ar', theme: 'dark', savedSize: 'extra-large' });
      await check(page, 'edge-browser-zoom-200', async () => {
        const settings = await context.newPage();
        await settings.goto('edge://settings/appearance');
        await settings.waitForFunction(() => typeof globalThis.chrome?.settingsPrivate?.getDefaultZoom === 'function');
        const metrics = () => page.evaluate(() => ({ width: innerWidth, dpr: devicePixelRatio, fontSize: getComputedStyle(document.documentElement).fontSize }));
        await openPatientPage(page, 'dashboard', '.canvas-readings');
        const before = await metrics();
        await settings.evaluate(() => new Promise(resolve => chrome.settingsPrivate.setDefaultZoom(2, resolve)));
        assert.equal(await settings.evaluate(() => new Promise(resolve => chrome.settingsPrivate.getDefaultZoom(resolve))), 2);
        await openPatientPage(page, 'dashboard', '.canvas-readings');
        const after = await metrics();
        report.zoom = { before, after };
        assert(after.width <= before.width * 0.55 && after.dpr >= before.dpr * 1.9);
        assert.equal(after.fontSize, before.fontSize);
        await fits(page);
        await targets(page, 'edge-browser-zoom-200', '.dashboard-record-pressure, .bottom-nav > :is(button, a)');
        await page.locator('.header-preferences-button').click();
        await fits(page);
        await capture(page, 'edge-browser-zoom-200-preferences');
        await page.keyboard.press('Escape');
        await capture(page, 'edge-browser-zoom-200-dashboard');
      });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser?.close();
  await vite.close();
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
}
console.log(`${report.checks.length} checks, ${report.targets.length} measured targets, ${report.errors.length} errors.`);
assert.equal(report.errors.length, 0);
