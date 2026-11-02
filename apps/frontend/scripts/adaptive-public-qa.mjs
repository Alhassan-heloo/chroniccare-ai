// Isolated public/auth presentation fixtures. Never connects to a real account API.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base = process.env.EXPERIENCE_BASE_URL || 'http://localhost:5188';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
await mkdir('artifacts/adaptive-public', { recursive: true });
const report = { cases: [], interactions: [], errors: [] };
try {
  for (const [width, language, theme] of [[320, 'en', 'light'], [390, 'ar', 'dark'], [1440, 'en', 'light'], [1440, 'ar', 'dark']]) {
    const context = await browser.newContext({ viewport: { width, height: 960 }, reducedMotion: 'reduce' });
    await context.addInitScript(({ language, theme }) => { localStorage.setItem('cc-language', language); localStorage.setItem('cc-theme', theme); }, { language, theme });
    const writes = [];
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      if (!path.startsWith('/api/')) { assert.equal(url.origin, base, 'No unexpected external request'); return route.continue(); }
      const method = route.request().method();
      if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) writes.push(method + ' ' + path);
      const status = method === 'OPTIONS' ? 204 : path.endsWith('/auth/me') ? 401 : 200;
      return route.fulfill({ status, headers: { 'Access-Control-Allow-Origin': base, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Content-Type,X-CSRF-Token', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' }, ...(status === 204 ? { body: '' } : { json: path.endsWith('/setup') ? { available: true } : path.endsWith('/csrf') ? { csrfToken: 'a'.repeat(64) } : {} }) });
    });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    for (const path of ['/', '/login', '/register', '/setup', '/forgot-password', '/reset-password#token=' + 'a'.repeat(64), '/activate-admin#token=' + 'a'.repeat(64)]) {
      await page.goto(base + path); await page.locator('h1').first().waitFor(); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(150);
      const layout = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth + 1, outside: [...document.querySelectorAll('main *')].filter(el => el.getClientRects().length && !el.closest('svg,.sr-only')).filter(el => { const r = el.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1; }).map(el => el.tagName + '.' + el.className) }));
      const name = width + '-' + language + '-' + theme + '-' + path.split('#')[0].replaceAll('/', '_');
      await page.screenshot({ path: 'artifacts/adaptive-public/' + name + '.png', fullPage: true });
      report.cases.push({ name, ...layout }); assert(!layout.overflow, name + ': page overflow'); assert.deepEqual(layout.outside, [], name + ': clipped content');
    }
    if (width <= 390) {
      await page.goto(base + '/register'); await page.locator('button[type=submit]').click();
      assert(await page.locator('[aria-invalid=true]').first().evaluate(el => el === document.activeElement));
      assert.equal(writes.length, 0, 'Invalid register form never calls API');
      await page.locator('.password-toggle').click(); assert.equal(await page.locator('#auth-password').getAttribute('type'), 'text');
      await page.goto(base + '/login'); await page.locator('button[type=submit]').click();
      assert(await page.locator('[aria-invalid=true]').first().evaluate(el => el === document.activeElement));
      assert.equal(writes.length, 0, 'Invalid login form never calls API');
      await page.goto(base + '/forgot-password'); await page.locator('input[type=email]').fill('fixture@example.test'); await page.locator('button[type=submit]').click(); await page.locator('.ui-feedback-success').waitFor();
      assert.equal(writes.filter(value => value.includes('/accounts/forgot-password')).length, 1);
      await page.goto(base + '/reset-password'); await page.locator('.ui-feedback-error').waitFor(); assert.equal(await page.locator('button[type=submit]').count(), 0);
      await page.goto(base + '/login'); await page.goto(base + '/reset-password#token=' + 'a'.repeat(64)); await page.locator('#recovery-password').waitFor(); assert.equal(new URL(page.url()).hash, '');
      await page.goto(base + '/');
      await page.locator('.adaptive-measurement-tabs button').last().click(); assert.equal(await page.locator('.adaptive-measurement-tabs button').last().getAttribute('aria-pressed'), 'true');
      await page.locator('.adaptive-chart-days button').first().click(); assert.equal(await page.locator('.adaptive-chart-days button').first().getAttribute('aria-pressed'), 'true');
      await page.locator('.adaptive-water-preview > button').click(); assert.equal(await page.locator('.adaptive-water-preview progress').getAttribute('value'), '7');
      await page.locator('.adaptive-daily-caption button').click(); assert.equal(await page.locator('.adaptive-water-preview progress').getAttribute('value'), '6');
      assert.equal(writes.length, 1, 'Public demo interactions never write health data');
      await page.locator('.public-menu-toggle').click(); await page.locator('#public-navigation').waitFor({ state: 'visible' }); await page.keyboard.press('Escape'); assert.equal(await page.locator('.public-menu-toggle').getAttribute('aria-expanded'), 'false');
      report.interactions.push(language + ': register/login validation focus and zero invalid requests; password visibility; recovery success, invalid link and token removal; demo type/day selection, progress/undo with no health writes; mobile menu Escape');
    }
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  console.log(`PASS: ${report.cases.length} public route/viewport/locale/theme cases; ${report.interactions.length} mobile interaction groups`);
} catch (error) { report.errors.push(error.message); console.error(error); process.exitCode = 1; }
finally { await browser.close(); await writeFile('artifacts/adaptive-public/report.json', JSON.stringify(report, null, 2)); }

