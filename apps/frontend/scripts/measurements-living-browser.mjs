// Local demo workflows only. No backend, credentials, fixtures or database writes.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const root = fileURLToPath(new URL('..', import.meta.url));
const before = process.argv.includes('--before');
const outputRoot = resolve(root, process.env.MEASUREMENTS_OUTPUT || 'artifacts/phase1e-measurements');
const output = resolve(outputRoot, before ? 'before' : 'after');
const base = 'http://127.0.0.1:5183';
const report = { cases: [], workflows: [], errors: [], backendRequests: [] };
await mkdir(output, { recursive: true });
const protectedPaths = [
  'src/pages/patient/DashboardPage.tsx', 'src/pages/patient/MedicationsPage.tsx',
  'src/pages/patient/HabitsPage.tsx', 'src/pages/patient/ReportsPage.tsx',
  'src/styles/living-dashboard.css', 'src/styles/living-public.css', 'src/styles/globals.css',
  'src/components/public', 'src/pages/auth', 'src/auth', 'src/lib', 'src/hooks', 'src/theme',
  'src/app/router.tsx', 'src/i18n/I18nProvider.tsx', '../backend/src', '../backend/migrations',
  '../../design-prototypes/chroniccare-living/src', '../../design-prototypes/chroniccare-living/public',
];
async function fingerprints(paths) {
  const result = {};
  async function visit(path) {
    const entries = await readdir(path, { withFileTypes: true }).catch(error => { if (error.code === 'ENOTDIR') return null; throw error; });
    if (entries) { for (const entry of entries) await visit(resolve(path, entry.name)); }
    else result[relative(root, path).replaceAll('\\', '/')] = createHash('sha256').update(await readFile(path)).digest('hex');
  }
  for (const path of paths) await visit(resolve(root, path));
  return result;
}
const hashes = await fingerprints(protectedPaths);
if (before) await writeFile(resolve(outputRoot, 'protected-sources.json'), JSON.stringify(hashes, null, 2));
else assert.deepEqual(hashes, JSON.parse(await readFile(resolve(outputRoot, 'protected-sources.json'), 'utf8')), 'Protected source changed since baseline');
report.protectedFiles = Object.keys(hashes).length;

async function navigate(page, path) {
  await page.evaluate(async path => { const { router } = await import('/src/app/router.tsx'); await router.navigate(path); }, path);
  await page.waitForURL(`${base}${path}`);
  const target = path.startsWith('/patient/measurements') ? '.measurements-page' : path.startsWith('/patient/dashboard') ? '.weekly-section .recharts-surface' : '.report-readings';
  await page.locator(target).waitFor();
}
async function enter(page) {
  await page.goto(`${base}/login`); await page.locator('.auth-card > .btn-secondary').click();
  await page.waitForURL('**/patient/dashboard'); await page.locator('.weekly-section .recharts-surface').waitFor();
}
async function measure(page, name, meta) {
  await page.evaluate(() => document.fonts.ready); await page.mouse.move(0, 0);
  await page.evaluate(() => window.scrollTo(0, 0));
  const geometry = await page.evaluate(() => {
    const visible = node => node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().height > 0 && getComputedStyle(node).visibility !== 'hidden';
    const containers = [...document.querySelectorAll('.measurements-page,.measurements-heading,.measurement-entry,.measurement-entry-heading,.measurement-entry-value,.measurement-entry-actions,.measurements-filters,.filter-fields,.field,dialog[open],.dialog-heading,.header-actions,.preferences')].filter(visible).filter(node => node.scrollWidth > node.clientWidth + 1).map(node => node.className);
    const overlaps = [];
    for (const row of document.querySelectorAll('.preferences,.header-actions,.measurement-entry-actions,.confirmation-actions,.dialog-heading,.bottom-nav')) {
      const children = [...row.children].filter(visible);
      for (let i = 0; i < children.length; i++) for (let j = i + 1; j < children.length; j++) {
        const a = children[i].getBoundingClientRect(), b = children[j].getBoundingClientRect();
        if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) overlaps.push(row.className);
      }
    }
    // Use the browser color parser, including CSS color-mix(). Composite ancestor
    // backgrounds for translucent surfaces. Gradients still receive visual review.
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const colorContext = canvas.getContext('2d', { willReadFrequently: true });
    const colors = new Map();
    const rgba = color => {
      if (!colors.has(color)) {
        colorContext.clearRect(0, 0, 1, 1); colorContext.fillStyle = color; colorContext.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = colorContext.getImageData(0, 0, 1, 1).data; colors.set(color, [r, g, b, a / 255]);
      }
      return colors.get(color);
    };
    const blend = (front, back) => front.slice(0, 3).map((value, i) => value * front[3] + back[i] * (1 - front[3]));
    const background = el => { const chain = []; for (let node = el; node; node = node.parentElement) chain.push(rgba(getComputedStyle(node).backgroundColor)); return chain.reverse().reduce((back, front) => blend(front, back), [255, 255, 255]); };
    const luminance = color => color.map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
    const textContrastFailures = [];
    for (const el of document.querySelectorAll('.living-measurements *')) {
      if (!visible(el) || el.closest('svg,.sr-only,[aria-hidden=true],button:disabled,dialog:not([open])')) continue;
      if (!el.matches('input,select') && ![...el.childNodes].some(node => node.nodeType === 3 && node.textContent.trim())) continue;
      const style = getComputedStyle(el), bg = background(el), foreground = blend(rgba(style.color), bg);
      const a = luminance(bg), b = luminance(foreground), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && parseInt(style.fontWeight) >= 700);
      if (ratio < (large ? 3 : 4.5)) textContrastFailures.push({ element: `${el.tagName}.${el.className}`, ratio, minimum: large ? 3 : 4.5 });
    }
    const root = document.querySelector('.living-public');
    const pick = (selector, props) => { const node = document.querySelector(selector); if (!node) return null; const style = getComputedStyle(node); return Object.fromEntries(props.map(prop => [prop, style.getPropertyValue(prop)])); };
    const system = {
      tokens: Object.fromEntries(['--bg', '--text', '--muted', '--surface', '--glass', '--hairline', '--border', '--shadow', '--radius', '--pressure', '--glucose', '--aqua'].map(token => [token, getComputedStyle(root).getPropertyValue(token).trim()])),
      background: getComputedStyle(root).backgroundImage,
      heading: pick('h1', ['font-family', 'font-size', 'font-weight', 'line-height', 'color']),
      headingSurface: pick('.measurements-heading,.dashboard-welcome', ['background-color', 'background-image', 'border-radius']),
      surface: pick('.measurement-results,.weekly-section', ['background-color', 'border-radius', 'box-shadow']),
      number: pick('.measurement-entry-value strong,.metric-number', ['font-family', 'font-size', 'font-weight', 'line-height', 'color']),
      icon: pick('.measurement-entry .dashboard-feature-icon,.measurement-entry .icon-tile,.dashboard-panel-heading .dashboard-feature-icon', ['width', 'height', 'border-radius']),
    };
    return { overflow: document.documentElement.scrollWidth - innerWidth, containers, overlaps, textContrastFailures, system, direction: document.documentElement.dir, theme: document.documentElement.dataset.theme, fontLoaded: document.fonts.check('16px Cairo'), hiddenOverflow: [document.body, document.documentElement].some(node => ['hidden', 'clip'].includes(getComputedStyle(node).overflowX)) };
  });
  await page.screenshot({ path: resolve(output, `${name}.png`), fullPage: true });
  await page.screenshot({ path: resolve(output, `${name}-viewport.png`) });
  if (!before && meta.width <= 390 && !meta.workflow && !meta.dashboard && !meta.home) {
    await page.locator('.measurement-entry').first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(output, `${name}-readings.png`) });
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  report.cases.push({ name, ...meta, ...geometry });
  if (!before) { assert(geometry.overflow <= 1, `${name}: document overflow`); assert.deepEqual(geometry.containers, [], `${name}: container overflow`); assert.deepEqual(geometry.overlaps, [], `${name}: controls overlap`); assert.deepEqual(geometry.textContrastFailures, [], `${name}: text contrast below AA`); assert(!geometry.hiddenOverflow); assert(geometry.fontLoaded); }
}
async function setup(browser, width, language, theme, motion = 'reduce') {
  const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 960 : width === 768 ? 1024 : 844 }, reducedMotion: motion });
  await context.addInitScript(({ language, theme }) => { localStorage.setItem('cc-language', language); localStorage.setItem('cc-theme', theme); localStorage.setItem('cc-public-motion', 'running'); }, { language, theme });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) report.errors.push(message.text()); });
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) report.backendRequests.push(new URL(request.url()).pathname); });
  await enter(page);
  return { context, page };
}
async function workflow(browser, language, width) {
  const { context, page } = await setup(browser, width, language, language === 'ar' ? 'light' : 'dark', 'no-preference');
  const tag = `workflow-${width}-${language}`, meta = { width, language, workflow: true };
  const entries = page.locator('.measurement-entry');
  const close = async () => { await page.keyboard.press('Escape'); await page.locator('dialog[open]').waitFor({ state: 'hidden' }); };
  const count = async value => { await page.waitForFunction(value => document.querySelectorAll('.measurement-entry').length === value, value); };
  try {
    await navigate(page, '/patient/measurements?review=living#main'); await count(14);
    const url = page.url();
    await page.locator('#filter-kind').selectOption('bloodPressure'); await count(7);
    for (let i = 0; i < 6; i++) { await page.locator('.language-toggle').click(); assert.equal(page.url(), url); assert.equal(await page.locator('#filter-kind').inputValue(), 'bloodPressure'); }
    await page.locator('#filter-kind').selectOption('glucose'); await count(7);
    await page.locator('.filter-fields > button').click(); await count(14);
    const day = await entries.first().locator('time').evaluate(node => { const d = new Date(node.dateTime); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
    await page.locator('.filter-fields input[type=date]').first().fill(day); await page.locator('.filter-fields input[type=date]').last().fill(day); await count(2);
    await page.locator('.filter-fields input[type=date]').first().fill('2099-01-01');
    await page.locator('.filter-fields [aria-invalid=true]').waitFor(); await measure(page, `${tag}-invalid-range`, meta);
    await page.locator('.filter-fields > button').click(); await count(14);
    await page.locator('.filter-fields input[type=date]').first().fill('2099-01-01'); await count(0);
    await measure(page, `${tag}-no-matches`, meta); await page.locator('.measurement-empty button').click(); await count(14);
    await page.locator('.measurements-heading > button,.measurements-actions > button').click();
    await page.locator('dialog[open] button[type=submit]').click(); await page.locator('dialog[open] [aria-invalid=true]').first().waitFor();
    const invalid = await page.locator('dialog[open] [aria-invalid=true]').first().getAttribute('aria-describedby');
    assert(invalid); assert(await page.locator(`[id="${invalid}"]`).isVisible());
    await measure(page, `${tag}-add-validation`, meta);
    await page.locator('input[name=systolic]').fill('80'); await page.locator('input[name=diastolic]').fill('90');
    await page.locator('dialog[open] button[type=submit]').click(); await page.locator('input[name=diastolic][aria-invalid=true]').waitFor();
    await page.locator('input[name=systolic]').fill('125'); await page.locator('input[name=diastolic]').fill('85');
    await page.locator('dialog[open] button[type=submit]').click(); await page.locator('dialog[open]').waitFor({ state: 'hidden' }); await count(15);
    const originalTime = await entries.first().locator('time').getAttribute('datetime');
    assert.match(await entries.first().innerText(), /125\/85/);
    await entries.first().locator('.measurement-entry-actions button').first().click();
    await page.locator('input[name=systolic]').fill('132'); await page.locator('input[name=diastolic]').fill('84');
    await measure(page, `${tag}-edit`, meta);
    await page.locator('dialog[open] button[type=submit]').click(); await page.locator('dialog[open]').waitFor({ state: 'hidden' });
    await page.waitForFunction(() => document.querySelector('.measurement-entry-value strong')?.textContent === '132/84');
    assert.equal(await entries.first().locator('time').getAttribute('datetime'), originalTime);
    await entries.first().locator('.measurement-entry-actions button').first().click();
    await page.locator('#reading-kind').selectOption('glucose'); assert.equal(await page.locator('input[name=systolic]').count(), 0);
    await page.locator('input[name=value]').fill('105.5'); await measure(page, `${tag}-glucose-form`, meta);
    await page.locator('dialog[open] button[type=submit]').click(); await page.locator('dialog[open]').waitFor({ state: 'hidden' });
    await page.waitForFunction(() => document.querySelector('.measurement-entry-value strong')?.textContent === '105.5');
    assert.equal(await entries.first().locator('time').getAttribute('datetime'), originalTime);
    await page.locator('.language-toggle').click(); await page.locator('.language-toggle').click(); assert.match(await entries.first().innerText(), /105.5/);
    await navigate(page, '/patient/dashboard'); assert.equal((await page.locator('.metric-number').last().innerText()).trim(), '105.5');
    await navigate(page, '/patient/reports'); assert.match(await page.locator('.report-readings').innerText(), /105.5/);
    await navigate(page, '/patient/measurements'); await count(15);
    await entries.first().locator('.measurement-entry-actions button').last().click(); await measure(page, `${tag}-delete`, meta);
    assert(await page.locator('dialog[open]').evaluate(node => node.contains(document.activeElement) && !document.activeElement.classList.contains('btn-danger')), 'Delete dialog initially focuses a safe control');
    await close(); await count(15);
    assert(await entries.first().locator('.measurement-entry-actions button').last().evaluate(node => node === document.activeElement));
    await entries.first().locator('.measurement-entry-actions button').last().click(); await page.locator('dialog[open] .btn-danger').click(); await page.locator('dialog[open]').waitFor({ state: 'hidden' }); await count(14);
    if (!before) {
      await page.locator('.motion-toggle').click(); assert.equal(await page.locator('.living-measurements').getAttribute('data-motion'), 'paused');
      await page.locator('.motion-toggle').click(); await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForFunction(() => document.querySelector('.living-measurements').dataset.motion === 'paused');
      assert(await page.locator('.motion-toggle').isDisabled()); await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.locator('.theme-select').selectOption('system');
      for (const os of ['dark', 'light']) { await page.emulateMedia({ colorScheme: os }); await page.waitForFunction(os => document.documentElement.dataset.theme === os, os); }
      await page.locator('.skip-link').focus(); await page.keyboard.press('Enter'); assert.equal(new URL(page.url()).pathname, '/patient/measurements'); assert(await page.locator('main').evaluate(node => node === document.activeElement));
      await page.locator('.skip-link').focus();
      for (let i = 0; i < 45; i++) {
        await page.keyboard.press('Tab');
        assert(await page.evaluate(() => { const el = document.activeElement, r = el.getBoundingClientRect(), bar = document.querySelector('.bottom-nav').getBoundingClientRect(); return el.closest('.bottom-nav') || !bar.height || r.bottom <= bar.top + 1 || r.top >= innerHeight || !r.height; }), 'Keyboard focus obscured by mobile bar');
      }
      for (let remaining = 14; remaining > 0; remaining--) {
        await entries.first().locator('.measurement-entry-actions button').last().click(); await page.locator('dialog[open] .btn-danger').click(); await page.locator('dialog[open]').waitFor({ state: 'hidden' }); await count(remaining - 1);
      }
      await page.locator('.measurement-empty').waitFor(); await measure(page, `${tag}-empty`, meta);
      await page.locator('.measurement-empty button').click(); await page.locator('#reading-kind').selectOption('glucose'); await page.locator('input[name=value]').fill('98');
      await page.locator('dialog[open] button[type=submit]').click(); await page.locator('dialog[open]').waitFor({ state: 'hidden' }); await count(1);
    }
    report.workflows.push({ language, width, status: 'PASS', checks: ['type/date filters and clear', 'invalid range/no matches', '6 language switches preserve URL and filter state', 'validation/errors linked to fields', 'add/edit/type change with preserved timestamp', 'dashboard/report synchronization', 'cancel/delete/focus return', ...before ? [] : ['motion off/reduced motion', 'system OS preferences', 'keyboard navigation', 'empty dataset and add from empty']] });
  } finally { await context.close(); }
}

const probe = createServer();
await new Promise((yes, no) => { probe.once('error', no); probe.listen(5183, '127.0.0.1', yes); }); await new Promise(yes => probe.close(yes));
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5183', '--strictPort'], { cwd: root, stdio: 'ignore' });
const stopped = once(server, 'exit'); let browser;
try {
  let ready = false;
  for (let i = 0; i < 120; i++) { try { if ((await fetch(base)).ok) { ready = true; break; } } catch { /* Startup only. */ } await new Promise(yes => setTimeout(yes, 250)); }
  assert(ready, 'Vite did not start');
  browser = await chromium.launch({ channel: 'msedge', headless: true }); report.browser = browser.version();
  for (const width of [1440, 768, 390, 320]) for (const language of ['ar', 'en']) for (const theme of ['light', 'dark']) {
    const { context, page } = await setup(browser, width, language, theme);
    try {
      if (width === 1440 || width === 390) await measure(page, `approved-dashboard-${width}-${language}-${theme}`, { width, language, theme, dashboard: true });
      await navigate(page, '/patient/measurements'); await page.locator('.measurement-entry').first().waitFor(); assert.equal(await page.locator('.measurement-entry').count(), 14);
      await measure(page, `measurements-${width}-${language}-${theme}`, { width, language, theme });
      assert.equal(await page.locator('html').getAttribute('dir'), language === 'ar' ? 'rtl' : 'ltr');
      if (!before && [1440, 390].includes(width)) {
        const dashboard = report.cases.find(item => item.name === `approved-dashboard-${width}-${language}-${theme}`).system;
        const measurements = report.cases.at(-1).system;
        for (const part of ['tokens', 'background', 'heading', 'headingSurface', 'surface', 'number', 'icon']) assert.deepEqual(measurements[part], dashboard[part], `${width}/${language}/${theme}: approved ${part} recipe diverged`);
      }
      if (process.argv.includes('--references') && language === 'ar' && [1440, 390].includes(width)) {
        await page.evaluate(async () => { const { router } = await import('/src/app/router.tsx'); await router.navigate('/'); });
        await page.locator('.intro-workspace .health-canvas').waitFor();
        await measure(page, `approved-home-${width}-${language}-${theme}`, { width, language, theme, home: true });
      }
    } finally { await context.close(); }
  }
  for (const language of ['ar', 'en']) for (const width of before ? [390] : [320, 1440]) await workflow(browser, language, width);
  assert.deepEqual(report.errors, []); assert.deepEqual(report.backendRequests, []);
  console.log(JSON.stringify({ status: 'PASS', cases: report.cases.length, workflows: report.workflows.length, output }));
} catch (error) { report.failure = error.message; throw error; }
finally { if (browser) await browser.close(); server.kill(); await stopped; await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2)); }
