// Isolated Living Evolution presentation and interaction checks. All API traffic is intercepted.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base = process.env.EXPERIENCE_BASE_URL || 'http://localhost:5188';
const output = resolve('artifacts/living-evolution-records');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = { source: 'All APIs intercepted. No database, provider, account or push writes.', screenshots: [], checks: [], errors: [], unexpected: [] };
const day = new Date();
const today = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
async function session(width, language, theme) {
  const context = await browser.newContext({ viewport: { width, height: 960 }, reducedMotion: 'reduce' });
  await context.addInitScript(({ language, theme }) => { localStorage.setItem('cc-language', language); localStorage.setItem('cc-theme', theme); localStorage.setItem('cc-public-motion', 'paused'); }, { language, theme });
  const state = {
    measurements: Array.from({ length: 7 }, (_, n) => [
      { id: `pressure-${n}`, kind: 'bloodPressure', systolic: 120 + n, diastolic: 80 + n, isExample: false, recordedAt: new Date(Date.now() - n * 86400000).toISOString() },
      { id: `glucose-${n}`, kind: 'glucose', value: 100 + n, isExample: false, recordedAt: new Date(Date.now() - n * 86400000).toISOString() },
    ]).flat(),
    medications: [{ id: 'medication', name: 'Fixture medication', dosage: 'As prescribed', notes: '', doses: [{ time: '08:00', takenOn: null }] }],
    habits: [{ id: 'habit', title: 'Fixture daily walk', unit: 'minutes', target: 30, progress: 15, templateKey: null, recordedOn: today }],
    writes: [], failProgress: false,
  };
  await context.route('**/*', async route => {
    const url = new URL(route.request().url()), path = url.pathname, method = route.request().method();
    if (!path.startsWith('/api/')) {
      if (url.origin !== base && !['data:', 'blob:'].includes(url.protocol)) { report.unexpected.push(url.origin); return route.abort(); }
      return route.continue();
    }
    const send = (json, status = 200) => route.fulfill({ status, headers: { 'Access-Control-Allow-Origin': base, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Content-Type,X-CSRF-Token', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS', 'Access-Control-Expose-Headers': 'X-Account-ID', 'X-Account-ID': 'fixture-patient' }, ...(status === 204 ? { body: '' } : { json }) });
    if (method === 'OPTIONS') return send(null, 204);
    const api = path.slice(4), body = ['POST', 'PUT'].includes(method) ? route.request().postDataJSON() : null;
    if (method !== 'GET') state.writes.push({ method, path: api, body });
    if (api === '/auth/me') return send({ user: { id: 'fixture-patient', name: 'Lina Fixture', email: 'patient@example.test', role: 'patient' } });
    if (api === '/auth/csrf') return send({ csrfToken: 'a'.repeat(64) });
    if (api === '/notifications/unread-count') return send({ unreadCount: 0 });
    if (api === '/notifications') return send({ notifications: [] });
    if (api === '/measurements' && method === 'GET') return send({ measurements: state.measurements });
    if (api === '/measurements' && method === 'POST') { const measurement = { ...body, id: 'new-reading', isExample: false, recordedAt: new Date().toISOString() }; state.measurements.unshift(measurement); return send({ measurement }, 201); }
    if (api.startsWith('/measurements/') && method === 'DELETE') { state.measurements = state.measurements.filter(item => item.id !== api.split('/').at(-1)); return send(null, 204); }
    if (api === '/medications' && method === 'GET') return send({ medications: state.medications });
    if (api.startsWith('/medications/') && api.includes('/doses/')) { state.medications[0].doses[0].takenOn = body.taken ? today : null; return send(null, 204); }
    if (api.startsWith('/medications/') && method === 'PUT') { state.medications[0] = { ...state.medications[0], ...body, doses: body.doses.map(dose => ({ ...dose, takenOn: today })) }; return send({ medication: state.medications[0] }); }
    if (api === '/habits' && method === 'GET') return send({ habits: state.habits });
    if (api.endsWith('/progress')) { if (state.failProgress) return send({ error: { code: 'UNAVAILABLE' } }, 503); state.habits[0].progress = body.value; return send(null, 204); }
    if (api === '/habits' && method === 'POST') { const habit = { ...body, id: 'template-habit', progress: 0, recordedOn: today, templateKey: body.templateKey ?? null }; state.habits.push(habit); return send({ habit }, 201); }
    report.unexpected.push(`${method} ${api}`); return send({ error: { code: 'FIXTURE_NOT_DEFINED' } }, 418);
  });
  const page = await context.newPage(); page.setDefaultTimeout(12000);
  page.on('pageerror', error => report.errors.push(error.message));
  return { context, page, state };
}
async function capture(page, name) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => !document.querySelector('.records-trend > p[role=status], .report-chart-panel > p[role=status]'));
  const geometry = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth + 1, historyWidth: document.querySelector('.measurement-results')?.getBoundingClientRect().width, workspaceWidth: document.querySelector('.measurements-workbench')?.getBoundingClientRect().width, outside: [...document.querySelectorAll('.records-page *')].filter(el => { if (!el.getClientRects().length || el.closest('svg,.sr-only,dialog:not([open]),.recharts-tooltip-wrapper,details:not([open]) > :not(summary)')) return false; const r = el.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1; }).map(el => el.tagName + '.' + el.className) }));
  const panelPadding = await page.locator('.measurement-canvas,.evolution-habit-row,.medication-schedule,.report-chart-panel').first().evaluate(el => parseFloat(getComputedStyle(el).paddingInlineStart));
  assert(panelPadding >= 16, name + ': component layer wins over browser resets');
  if (geometry.overflow || geometry.outside.length) { await page.screenshot({ path: resolve(output, name + '-failure.png'), fullPage: true }); console.error(JSON.stringify(geometry)); }
  assert(!geometry.overflow, name + ': page overflow'); assert.deepEqual(geometry.outside, [], name + ': content outside viewport');
  if (geometry.historyWidth) assert(geometry.historyWidth >= geometry.workspaceWidth - 2, name + ': history fills the workspace');
  const path = resolve(output, name + '.png'); await page.screenshot({ path, fullPage: true, animations: 'disabled' }); report.screenshots.push(path);
}
try {
  for (const [width, language, theme] of [[320, 'en', 'light'], [390, 'ar', 'light'], [1440, 'en', 'dark']]) {
    const { context, page, state } = await session(width, language, theme);
    const tag = `${width}-${language}-${theme}`;
    for (const route of ['measurements', 'medications', 'habits', 'reports']) {
      await page.goto(base + '/patient/' + route); await page.locator('.records-page h1').waitFor();
      const ready = { measurements: '.measurement-entry', medications: '.medication-schedule', habits: '.habit-detail', reports: '.report-summary' };
      await page.locator(ready[route]).first().waitFor(); await capture(page, `${tag}-${route}`);
      if (route === 'measurements') {
        assert.equal(await page.locator('.records-latest-item').count(), 2);
        await page.locator('.measurement-filter-panel > summary').click(); await page.locator('#filter-kind').selectOption('glucose'); await page.waitForFunction(() => document.querySelectorAll('.measurement-entry').length === 7);
        await page.locator('.records-latest-item').last().click(); assert.equal(await page.locator('.records-trend').getAttribute('data-kind'), 'glucose');
        await page.locator('.records-heading > button').click(); await page.locator('dialog[open] input[name=systolic]').fill('125'); await page.locator('dialog[open] input[name=diastolic]').fill('82');
        await page.locator('dialog[open] button[type=submit]').click(); await page.locator('dialog[open]').waitFor({ state: 'hidden' });
        assert.equal(state.writes.filter(item => item.method === 'POST' && item.path === '/measurements').length, 1);
        await page.locator('.measurement-entry-actions button').last().click(); await page.keyboard.press('Escape'); assert.equal(await page.locator('dialog[open]').count(), 0);
      }
      if (route === 'medications') {
        await page.locator('.dose-action').click(); await page.waitForFunction(() => document.querySelector('.medication-summary progress').value === 1);
        await page.locator('.medication-card-actions button').first().click(); await page.locator('input[name=dosage]').fill('Fixture updated dose'); await page.locator('dialog[open] button[type=submit]').click(); await page.locator('dialog[open]').waitFor({ state: 'hidden' });
        await page.waitForFunction(() => document.querySelector('.medication-dosage').textContent.includes('Fixture updated dose'));
        await page.locator('.medication-card-actions button').last().click(); await page.keyboard.press('Escape'); assert.equal(await page.locator('dialog[open]').count(), 0);
      }
      if (route === 'habits') {
        await page.locator('.habit-quick-add').click(); await page.waitForFunction(() => document.querySelector('.habit-value').textContent.includes('20') || document.querySelector('.habit-value').textContent.includes('٢٠'));
        await page.waitForFunction(() => !document.querySelector('.habit-record').disabled);
        assert.equal(state.habits[0].progress, 20);
        state.failProgress = true; await page.locator('.habit-quick-add').click(); await page.waitForFunction(() => !document.querySelector('.habit-record').disabled);
        assert.equal(state.habits[0].progress, 20, 'Failed optimistic update rolls back');
        state.failProgress = false;
        assert.equal(await page.locator('.records-template-disclosure').getAttribute('open'), null);
        await page.locator('.records-template-disclosure > summary').click(); await page.locator('[data-template=walking] .habit-template-add').click();
        await page.waitForFunction(() => document.querySelectorAll('.habit-detail').length === 2);
        assert.equal(state.writes.filter(item => item.method === 'POST' && item.path === '/habits').length, 1);
        assert.equal(state.habits[1].templateKey, 'walking'); await capture(page, `${tag}-templates-expanded`);
      }
      if (route === 'reports') { await page.locator('.report-periods button').nth(1).click(); assert.equal(await page.locator('.report-periods button').nth(1).getAttribute('aria-pressed'), 'true'); }
    }
    report.checks.push(`${tag}: 4 page compositions, latest readings, chart toggle, history filter, measurement create/cancel, dose log, medication edit/cancel, habit quick progress/rollback, template disclosure/identity/single create, report period`);
    await context.close();
  }
  assert.deepEqual(report.errors, []); assert.deepEqual(report.unexpected, []);
  console.log(`PASS: ${report.checks.length} viewport/locale/theme workflows, ${report.screenshots.length} screenshots`);
} catch (error) { report.errors.push(error.message); console.error(error); process.exitCode = 1; }
finally { await browser.close(); await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2)); }
