import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const before = process.argv.includes('--before');
const origin = process.env.APP_ORIGIN || 'http://127.0.0.1:5177';
const output = resolve('artifacts/phase1d', before ? 'before' : 'after');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = { browser: browser.version(), origin, checks: [], errors: [], screenshots: [] };
try {
  for (const width of [1440, 768, 390, 320]) for (const language of ['ar', 'en']) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: width > 800 ? 960 : 844 }, reducedMotion: 'reduce' });
    await context.addInitScript(({ language, theme }) => {
      localStorage.setItem('cc-language', language); localStorage.setItem('cc-theme', theme);
      localStorage.setItem('cc-living-language', language); localStorage.setItem('cc-living-theme', theme);
    }, { language, theme });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', message => { if (['error', 'warning'].includes(message.type())) report.errors.push(message.text()); });
    for (const route of ['', 'login', 'register']) {
      await page.goto(`${origin}/${route}`);
      await page.locator('h1').waitFor(); await page.evaluate(() => document.fonts.ready);
      if (!before) {
        assert.equal(await page.locator('html').getAttribute('dir'), language === 'ar' ? 'rtl' : 'ltr');
        assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
        assert(await page.evaluate(() => document.fonts.check('16px Cairo')), 'Local Cairo unavailable');
        assert(await page.locator('.overline').evaluateAll(nodes => nodes.every(node => getComputedStyle(node).textDecorationLine === 'none')), 'Unintended Tailwind text overline');
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Overflow ${width}/${language}/${theme}/${route}`);
        assert.equal(await page.locator('button').evaluateAll(nodes => nodes.filter(node => node.getBoundingClientRect().width && !(node.textContent.trim() || node.getAttribute('aria-label'))).length), 0);
        if (language === 'en') assert(!/[\u0600-\u06ff]/.test(await page.locator('main').innerText()), 'Arabic in English public content');
      }
      const file = `${route || 'home'}-${width}-${language}-${theme}.png`;
      await page.screenshot({ path: resolve(output, file), fullPage: true }); report.screenshots.push(file);
      report.checks.push(`${width}/${language}/${theme}/${route || 'home'}`);
    }
    if (!before && width === 320) {
      const target = `${origin}/register?returnTo=%2Fpatient%2Fmeasurements%3Frange%3D7%23history#account`;
      await page.goto(target);
      await page.locator('input[autocomplete=name]').fill('Mixed مستخدم');
      await page.locator('input[type=email]').fill('preview@example.test');
      await page.locator('.language-toggle').click();
      assert.equal(page.url(), target); assert.equal(await page.locator('input[autocomplete=name]').inputValue(), 'Mixed مستخدم');
      await page.locator('.language-toggle').click();
      await page.locator('button[type=submit]').click();
      await page.locator('[aria-invalid=true]').first().waitFor();
      assert(await page.locator('[aria-invalid=true]').first().evaluate(node => node === document.activeElement));
      assert(await page.locator('[aria-invalid=true]').first().evaluate(node => node.getAttribute('aria-describedby').split(/\s+/).every(id => !!document.getElementById(id))));
      await page.locator('.theme-select').selectOption('system');
      for (const colorScheme of ['light', 'dark']) { await page.emulateMedia({ colorScheme }); await page.waitForFunction(value => document.documentElement.dataset.theme === value, colorScheme); }
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.locator('.motion-toggle').click();
      assert.equal(await page.locator('.living-public').getAttribute('data-motion'), 'paused');
      await page.reload(); assert.equal(await page.locator('.living-public').getAttribute('data-motion'), 'paused');
      await page.locator('.public-menu-toggle').click(); await page.keyboard.press('Escape');
      assert.equal(await page.locator('.public-menu-toggle').getAttribute('aria-expanded'), 'false');
      assert(await page.locator('.public-menu-toggle').evaluate(node => node === document.activeElement));
      await page.focus('.skip-link'); await page.keyboard.press('Enter');
      assert.equal(page.url(), target); assert(await page.locator('main').evaluate(node => node === document.activeElement));
      await page.goto(`${origin}/`);
      const chart = page.locator('.health-canvas').first();
      await chart.locator('.measurement-switch button').nth(1).click();
      assert.equal(await chart.getAttribute('data-kind'), 'glucose');
      await chart.locator('input[type=range]').fill('0');
      assert.equal(await chart.locator('.chart-point[aria-pressed=true]').count(), 1);
      await chart.locator('.chart-point[aria-pressed=true]').focus(); await page.keyboard.press('End');
      assert.equal(await chart.locator('input[type=range]').inputValue(), '6');
      const dose = page.locator('.dose-action').first(); await dose.click(); assert.equal(await dose.getAttribute('aria-pressed'), 'true'); await dose.click();
      const sentence = page.locator('.habit-sentence').first(), original = await sentence.innerText();
      await page.locator('.water-action').click(); assert.notEqual(await sentence.innerText(), original);
      await page.locator('.habit-undo').first().click(); assert.equal(await sentence.innerText(), original);
      const period = page.locator('.report-toolbar select'); await period.selectOption('3');
      await page.locator('.report-details summary').click(); assert.equal(await page.locator('.ledger-row').count(), 3);
      await page.locator('.assistant-panel summary').click(); await page.locator('.no-response').waitFor({ state: 'visible' });
      const help = page.locator('.habits-panel .context-help'); await help.locator('summary').click();
      assert(await help.locator('.help-bubble').evaluate(node => { const r = node.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }));
      await page.keyboard.press('Escape'); assert.equal(await help.getAttribute('open'), null);
      report.checks.push(`${language}/${theme}: form retention, errors/focus, URL, system themes, motion persistence, menu/skip, chart keyboard, doses, habits/undo, reports, assistant/help`);
    }
    if (width === 1440 || width === 390) {
      await page.goto('http://127.0.0.1:5206/'); await page.locator('#home-title').waitFor(); await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: resolve(output, `reference-home-${width}-${language}-${theme}.png`), fullPage: true });
      // Living's account actions are disclosures, not credential forms. Capture them truthfully.
      for (const action of ['login', 'register']) {
        if (!(await page.locator('.login-action').isVisible())) await page.locator('.menu-toggle').click();
        await page.locator(action === 'login' ? '.login-action' : '.register-action').click();
        await page.screenshot({ path: resolve(output, `reference-${action}-${width}-${language}-${theme}.png`), fullPage: true });
        await page.keyboard.press('Escape');
      }
    }
    await context.close();
  }
  assert.deepEqual(report.errors, []);
} finally {
  await browser.close(); await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
}
console.log(`PASS ${report.checks.length} public page cases`);
