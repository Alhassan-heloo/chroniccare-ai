// Presentation fixtures only. Every API request is intercepted; no live account/data writes.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const before = process.argv.includes('--before');
const interactionsOnly = process.argv.includes('--interactions-only');
const output = resolve('artifacts/adaptive', before ? 'before' : 'after');
await mkdir(output, { recursive: true });
const base = process.env.EXPERIENCE_BASE_URL || 'http://localhost:5188';
const report = { baseURL: base, source: 'Isolated browser fixtures; all API traffic intercepted', cases: [], errors: [], unexpected: [], interactions: [] };
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const patient = { id: 'presentation-patient', name: 'Lina Haddad', email: 'patient@example.test', role: 'patient' };
const doctor = { id: 'presentation-doctor', name: 'Dr Samia Nour', email: 'doctor@example.test', role: 'doctor' };
const today = new Date().toISOString().slice(0, 10);
const measurements = Array.from({ length: 7 }, (_, n) => ({ id: 'reading-' + n, kind: 'bloodPressure', systolic: 124 - n, diastolic: 82 - n, recordedAt: new Date(Date.now() - n * 86400000).toISOString(), isExample: false }));
const medications = [{ id: 'medication', name: 'Presentation medication', dosage: 'As prescribed', notes: '', doses: [{ time: '08:00', takenOn: null }] }];
const habits = [{ id: 'habit', title: 'Daily walk', unit: 'minutes', target: 30, progress: 15, templateKey: null, recordedOn: today }];
const publicRoutes = ['/', '/login', '/register', '/forgot-password', '/reset-password#token=' + 'a'.repeat(64), '/activate-admin#token=' + 'a'.repeat(64), '/setup', '/not-found'];
const roleRoutes = { patient: ['dashboard', 'measurements', 'medications', 'habits', 'reports', 'assistant', 'profile', 'doctors'], doctor: ['dashboard', 'patients', 'patients/presentation-patient', 'connect'], admin: ['dashboard'] };
async function session(role, language, theme, width) {
  const context = await browser.newContext({ viewport: { width, height: 960 }, reducedMotion: 'reduce', colorScheme: theme });
  await context.addInitScript(({ language, theme }) => { localStorage.setItem('cc-language', language); localStorage.setItem('cc-theme', theme); localStorage.setItem('cc-public-motion', 'paused'); }, { language, theme });
  const user = role === 'patient' ? patient : role === 'doctor' ? doctor : role === 'admin' ? { ...doctor, id: 'presentation-admin', role: 'admin' } : null;
  const state = { empty: false, error: false, read: false, revoked: false, writes: [], hold: null, revokeHold: null };
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith('/api/')) {
      if (url.origin !== base && !['data:', 'blob:'].includes(url.protocol)) { report.unexpected.push(url.origin); return route.abort(); }
      return route.continue();
    }
    const path = url.pathname.slice(4), method = route.request().method();
    const send = (status, json) => route.fulfill({ status, headers: { 'Access-Control-Allow-Origin': base, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Content-Type,X-CSRF-Token', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS', 'Access-Control-Expose-Headers': 'X-Account-ID', 'X-Account-ID': user?.id || '' }, ...(status === 204 ? { body: '' } : { json }) });
    if (method === 'OPTIONS') return send(204);
    if (!['GET', 'HEAD'].includes(method)) state.writes.push(method + ' ' + path);
    if (path === '/auth/csrf') return send(200, { csrfToken: 'a'.repeat(64) });
    if (path === '/auth/me') return send(user ? 200 : 401, user ? { user } : { error: { code: 'UNAUTHENTICATED' } });
    if (path === '/setup') return send(200, { available: true });
    if (path === '/accounts/forgot-password') return send(200, {});
    if (state.error && ['/connections/doctors', '/doctor/patients', '/notifications'].includes(path)) return send(503, { error: { code: 'UNAVAILABLE' } });
    if (path === '/measurements') return send(200, { measurements: state.empty ? [] : measurements });
    if (path === '/medications') return send(200, { medications: state.empty ? [] : medications });
    if (path === '/habits') return send(200, { habits: state.empty ? [] : habits });
    if (path === '/doctor/patients') return send(200, { patients: state.empty ? [] : [{ id: patient.id, name: patient.name }] });
    if (path.startsWith('/doctor/patients/')) return send(200, { patient: { id: patient.id, name: patient.name }, date: today, measurements, medications, habits });
    if (path === '/admin/doctors') return send(200, { doctors: [doctor] });
    if (path === '/connections/doctors') return send(200, { doctors: state.empty || state.revoked ? [] : [{ ...doctor, role: undefined, approvedAt: new Date().toISOString() }] });
    if (path === '/connections/preview') return send(200, { doctor: { id: doctor.id, name: doctor.name, email: doctor.email } });
    if (path.startsWith('/connections/doctors/') && method === 'DELETE') { if (state.revokeHold) await state.revokeHold; state.revoked = true; return send(204); }
    if (path === '/connections/codes') return send(200, { code: 'CC-EXAMPLE-CODE', expiresAt: new Date(Date.now() + 600000).toISOString() });
    if (path === '/notifications/unread-count') return send(200, { unreadCount: state.read ? 0 : 1 });
    const notification = { id: 'notification', type: 'connection_approved', createdAt: new Date().toISOString(), readAt: state.read ? new Date().toISOString() : null };
    if (path === '/notifications') { if (state.hold) await state.hold; return send(200, { notifications: state.empty ? [] : [notification] }); }
    if (path.endsWith('/read')) { state.read = true; return send(200, { notification: { ...notification, readAt: new Date().toISOString() } }); }
    if (path === '/notifications/browser-registration') return send(200, { registered: false, context: 'fixture-only' });
    report.unexpected.push(method + ' ' + path); return send(418, { error: { code: 'FIXTURE_NOT_DEFINED' } });
  });
  const page = await context.newPage(); page.setDefaultTimeout(12000);
  page.on('pageerror', error => report.errors.push(error.message));
  return { context, page, state };
}
async function capture(page, name) {
  await page.locator('h1').first().waitFor();
  await page.locator('.dashboard-canvas-loading').waitFor({ state: 'hidden' });
  await page.waitForFunction(() => !document.querySelector('.records-trend > p[role="status"], .report-chart-panel > p[role="status"], .clinical-record-trends > p[role="status"]'));
  await page.evaluate(async () => { await document.fonts.load('16px Cairo'); await document.fonts.ready; });
  await page.waitForFunction(() => document.fonts.check('16px Cairo'));
  await page.waitForTimeout(180);
  const result = await page.evaluate(() => {
    const outside = [...document.querySelectorAll('main *, .app-header *, .role-mobile-nav *')].filter(el => {
      if (!el.getClientRects().length || el.closest('svg,.sr-only,dialog:not([open]),.recharts-tooltip-wrapper')) return false;
      const r = el.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1;
    }).map(el => el.tagName + '.' + el.className);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true }), cache = new Map();
    const rgba = color => { if (!cache.has(color)) { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); cache.set(color, [...ctx.getImageData(0, 0, 1, 1).data].map((v, i) => i === 3 ? v / 255 : v)); } return cache.get(color); };
    const blend = (a, b) => a.slice(0, 3).map((v, i) => v * a[3] + b[i] * (1 - a[3]));
    const luminance = color => color.map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    const contrastFailures = [];
    for (const el of document.querySelectorAll('.living-public *')) {
      if (!el.getClientRects().length || el.closest('svg,.sr-only,[aria-hidden=true],button:disabled,fieldset:disabled,dialog:not([open])')) continue;
      if (![...el.childNodes].some(node => node.nodeType === 3 && node.textContent.trim())) continue;
      const style = getComputedStyle(el); if (style.visibility === 'hidden' || style.opacity === '0') continue;
      const chain = []; for (let node = el; node; node = node.parentElement) chain.push(rgba(getComputedStyle(node).backgroundColor));
      const bg = chain.reverse().reduce((back, front) => blend(front, back), [255, 255, 255]);
      const a = luminance(blend(rgba(style.color), bg)), b = luminance(bg), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      const minimum = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && parseInt(style.fontWeight) >= 700) ? 3 : 4.5;
      if (ratio < minimum) contrastFailures.push({ element: el.tagName + '.' + el.className, text: el.textContent.trim().slice(0, 70), ratio: Math.round(ratio * 100) / 100, minimum });
    }
    return { width: innerWidth, lang: document.documentElement.lang, dir: document.documentElement.dir, theme: document.documentElement.dataset.theme, fontLoaded: document.fonts.check('16px Cairo'), overflow: document.documentElement.scrollWidth > innerWidth + 1, outside, contrastFailures };
  });
  await page.screenshot({ path: resolve(output, name + '.png'), fullPage: true, animations: 'disabled' });
  if (name.startsWith('interaction-')) await page.screenshot({ path: resolve(output, name + '-viewport.png'), animations: 'disabled' });
  report.cases.push({ name, ...result });
  if (!before) { assert(!result.overflow, name + ': document overflow'); assert.deepEqual(result.outside, [], name + ': content outside viewport'); assert.equal(result.dir, result.lang === 'ar' ? 'rtl' : 'ltr'); assert(result.fontLoaded); assert.deepEqual(result.contrastFailures, [], name + ': sampled text contrast below AA'); }
}
async function interactions() {
  for (const language of ['en', 'ar']) {
    const { page, context, state } = await session('patient', language, 'dark', 320);
    await page.goto(base + '/patient/doctors');
    await page.locator('.connection-current .card').waitFor();
    await page.locator('.connection-review-card button[type=submit]').click();
    assert(await page.locator('[aria-invalid=true]').evaluate(el => el === document.activeElement));
    assert.equal(state.writes.length, 0, 'Empty code never calls the API');
    await page.locator('.connection-review-card input').fill('CC-EXAMPLE-CODE');
    await page.locator('.connection-review-card button[type=submit]').click();
    await page.locator('.connection-review-card section').waitFor();
    await capture(page, `interaction-${language}-connection-preview`);
    const revoke = page.locator('.connection-current .card button');
    await revoke.click(); await page.locator('dialog[open]').waitFor();
    await capture(page, `interaction-${language}-revoke-dialog`);
    await page.keyboard.press('Escape'); await page.locator('dialog[open]').waitFor({ state: 'hidden' });
    assert(await revoke.evaluate(el => el === document.activeElement), 'Dialog restores trigger focus');
    assert(!state.revoked, 'Cancel preserves access');
    let releaseRevoke; state.revokeHold = new Promise(done => { releaseRevoke = done; });
    await revoke.click(); await page.locator('dialog[open] .btn-primary').click();
    await page.locator('dialog[open] .btn-primary[aria-busy=true]').waitFor();
    await page.keyboard.press('Escape'); assert.equal(await page.locator('dialog[open]').count(), 1, 'Pending confirmation cannot be dismissed');
    releaseRevoke(); state.revokeHold = null;
    await page.locator('.connection-current .ui-feedback-empty').waitFor();
    assert.equal(state.writes.filter(value => value.startsWith('DELETE ')).length, 1);
    await page.locator('.notification-bell').click();
    await page.locator('.notification-center li.is-unread').waitFor();
    await capture(page, `interaction-${language}-notification-unread`);
    await page.locator('.notification-center li button').click();
    await page.locator('.notification-center li.is-read').waitFor();
    assert.equal(await page.locator('.notification-badge').count(), 0);
    await page.keyboard.press('Escape');
    state.empty = true; await page.reload(); await page.locator('.notification-bell').click();
    await page.locator('.notification-center .ui-feedback-empty').waitFor();
    await capture(page, `interaction-${language}-notification-empty`);
    await page.keyboard.press('Escape');
    state.error = true; await page.reload(); await page.locator('.notification-bell').click();
    await page.locator('.notification-center .ui-feedback-error').waitFor();
    await capture(page, `interaction-${language}-notification-error`);
    state.error = false;
    await page.locator('.notification-center .ui-feedback-error button').click();
    await page.locator('.notification-center .ui-feedback-empty').waitFor();
    await page.keyboard.press('Escape');
    let release; state.hold = new Promise(done => { release = done; });
    await page.reload(); await page.locator('.notification-bell').click();
    await page.locator('.notification-center .ui-feedback-loading').waitFor();
    await capture(page, `interaction-${language}-notification-loading`);
    release(); state.hold = null; await page.locator('.notification-center .ui-feedback-empty').waitFor();
    await page.keyboard.press('Escape');
    await page.locator('.header-preferences-button').click();
    await page.locator('.theme-select').selectOption('system');
    for (const colorScheme of ['light', 'dark']) { await page.emulateMedia({ colorScheme }); await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, colorScheme); }
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.locator('.motion-toggle').click();
    assert.equal(await page.locator('.experience-shell').getAttribute('data-motion'), 'running');
    await page.locator('.motion-toggle').click(); await page.keyboard.press('Escape'); await page.reload();
    assert.equal(await page.locator('.experience-shell').getAttribute('data-motion'), 'paused');
    await page.locator('.bottom-nav button').last().click();
    await page.locator('dialog[open] a[href="/patient/profile"]').click();
    await page.locator('.account-identity h2').waitFor();
    assert.equal(await page.locator('dialog[open]').count(), 0);
    await page.locator('.skip-link').focus(); await page.keyboard.press('Enter');
    assert(await page.locator('main').evaluate(el => el === document.activeElement));
    report.interactions.push(language + ': code validation/preview, revoke confirmation/cancel/focus/single request, notification unread/read/empty/error/retry/loading, system appearance, Motion Off persistence, mobile more menu, skip link');
    await context.close();
    const clinical = await session('doctor', language, 'light', 768);
    await clinical.page.goto(base + '/doctor/patients/' + patient.id);
    await clinical.page.locator('.doctor-record').waitFor();
    assert.equal(await clinical.page.locator('.sidebar a.active').getAttribute('href'), '/doctor/patients');
    assert.equal(await clinical.page.locator('.doctor-record input,.doctor-record textarea').count(), 0);
    await clinical.page.locator('.sidebar a[href="/doctor/connect"]').click();
    await clinical.page.locator('.connection-code-card button').click();
    const code = clinical.page.locator('.connection-code-card input'); await code.waitFor(); await code.focus();
    assert.equal(await code.evaluate(el => el.selectionEnd - el.selectionStart), 'CC-EXAMPLE-CODE'.length);
    await capture(clinical.page, `interaction-${language}-doctor-code`);
    clinical.state.error = true; await clinical.page.goto(base + '/doctor/patients');
    await clinical.page.locator('main .ui-feedback-error').waitFor();
    clinical.state.error = false; clinical.state.empty = true; await clinical.page.locator('main .ui-feedback-error button').click();
    await clinical.page.locator('main .ui-feedback-empty').waitFor();
    report.interactions.push(language + ': clinical tablet navigation, nested breadcrumb, read-only record, code generation/selection, patient list error/retry/empty');
    await clinical.context.close();
    const recovery = await session('public', language, 'light', 320);
    await recovery.page.goto(base + '/forgot-password'); await recovery.page.locator('button[type=submit]').click();
    assert(await recovery.page.locator('[aria-invalid=true]').evaluate(el => el === document.activeElement));
    await recovery.page.locator('input[type=email]').fill('fixture@example.test'); await recovery.page.locator('button[type=submit]').click();
    await recovery.page.locator('.ui-feedback-success').waitFor();
    await recovery.page.goto(base + '/reset-password#token=' + 'a'.repeat(64));
    await recovery.page.locator('#recovery-password').waitFor();
    await recovery.page.waitForURL(url => !url.hash);
    assert(!recovery.page.url().includes('#'), 'Account token removed from visible URL');
    await recovery.page.locator('button[type=submit]').click();
    await recovery.page.locator('[aria-invalid=true]').first().waitFor();
    assert(await recovery.page.locator('[aria-invalid=true]').first().evaluate(el => el === document.activeElement));
    await recovery.page.locator('.password-toggle').click(); assert.equal(await recovery.page.locator('#recovery-password').getAttribute('type'), 'text');
    await capture(recovery.page, `interaction-${language}-recovery-validation`);
    report.interactions.push(language + ': recovery inline errors/focus, request success, reset URL token removal and password visibility');
    await recovery.context.close();
  }
}
try {
  const settings = before ? [['en', 'dark', 1440], ['ar', 'light', 390]] : [['en', 'dark', 1440], ['ar', 'light', 390], ['en', 'light', 320], ['ar', 'dark', 360], ['en', 'light', 430], ['ar', 'dark', 768], ['en', 'light', 1024], ['en', 'light', 1920]];
  if (!interactionsOnly) for (const [language, theme, width] of settings) for (const role of ['public', 'patient', 'doctor', 'admin']) {
    const { context, page } = await session(role, language, theme, width);
    const routes = role === 'public' ? publicRoutes : roleRoutes[role].map(path => '/' + role + '/' + path);
    for (const path of routes) { await page.goto(base + path); await capture(page, `${width}-${language}-${theme}-${path.split('#')[0].replaceAll('/', '_') || 'home'}`); }
    await context.close();
  }
  if (!before) await interactions();
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.unexpected, []);
  console.log(`PASS ${report.cases.length} route/viewport/locale/theme cases`);
} catch (error) { report.errors.push(error.message); console.error(error); process.exitCode = 1; }
finally { await browser.close(); await writeFile(resolve(output, interactionsOnly ? 'interactions.json' : 'report.json'), JSON.stringify(report, null, 2)); }
