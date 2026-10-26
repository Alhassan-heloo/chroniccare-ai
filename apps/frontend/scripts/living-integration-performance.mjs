import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { cpus, platform, release } from 'node:os';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const output = resolve('artifacts/phase1d/performance'); await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const rows = [], environment = { browser: browser.version(), cpu: cpus()[0]?.model, platform: platform(), release: release(), dpr: 1, headless: true, language: 'ar', theme: 'dark', throttling: 'none', reference: 'Living 3.3 Production :5206', integrated: 'Frontend Production :5179', note: 'Different applications, not an isolated pre/post integration regression benchmark. rAF is not physical displayed FPS. No physical phone or measured monitor refresh.' };
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 960 : 844 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
    await context.addInitScript(() => {
      localStorage.setItem('cc-language', 'ar'); localStorage.setItem('cc-theme', 'dark'); localStorage.setItem('cc-public-motion', 'running');
      localStorage.setItem('cc-living-language', 'ar'); localStorage.setItem('cc-living-theme', 'dark'); localStorage.setItem('cc-living-motion', 'running');
    });
    for (let repetition = 0; repetition < 5; repetition++) for (const variant of repetition % 2 ? ['integrated', 'reference'] : ['reference', 'integrated']) {
      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:${variant === 'reference' ? '5206' : '5179'}/`);
      await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(1500);
      const session = await context.newCDPSession(page); await session.send('Performance.enable');
      const baseline = Object.fromEntries((await session.send('Performance.getMetrics')).metrics.map(item => [item.name, item.value]));
      await page.evaluate(() => {
        const sample = { frames: [], cls: 0, longTasks: 0, running: true, last: 0 };
        window.__phase1d = sample;
        new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) sample.cls += entry.value; }).observe({ type: 'layout-shift', buffered: true });
        new PerformanceObserver(list => { sample.longTasks += list.getEntries().length; }).observe({ type: 'longtask' });
        function tick(now) { if (!sample.running) return; if (sample.last) sample.frames.push(now - sample.last); sample.last = now; requestAnimationFrame(tick); }
        requestAnimationFrame(tick);
      });
      const start = Date.now(), canvas = page.locator('.health-canvas').first();
      for (let index = 0; index < 4; index++) {
        await canvas.locator('.measurement-switch button').nth(index % 2 ? 0 : 1).click();
        if (width === 1440) {
          const box = await canvas.boundingBox();
          for (let step = 0; step < 15; step++) await page.mouse.move(box.x + 20 + step * (box.width - 40) / 14, box.y + box.height * .65);
        } else await canvas.locator('input[type=range]').fill(index % 2 ? '6' : '0');
      }
      for (let step = 0; step < 4; step++) { await page.keyboard.press('PageDown'); await page.waitForTimeout(100); }
      await page.waitForTimeout(Math.max(0, 4000 - (Date.now() - start)));
      const data = await page.evaluate(() => { window.__phase1d.running = false; return window.__phase1d; });
      const final = Object.fromEntries((await session.send('Performance.getMetrics')).metrics.map(item => [item.name, item.value]));
      const sorted = [...data.frames].sort((a, b) => a - b), at = percentile => sorted[Math.floor((sorted.length - 1) * percentile)];
      assert(sorted.length > 50, 'Insufficient frames');
      rows.push({ width, variant, repetition, durationMs: Date.now() - start, medianMs: at(.5), p95Ms: at(.95), longFrames: data.frames.filter(value => value > 50).length, cls: data.cls, longTasks: data.longTasks, taskMs: (final.TaskDuration - baseline.TaskDuration) * 1000, styleMs: (final.RecalcStyleDuration - baseline.RecalcStyleDuration) * 1000, frames: data.frames });
      await page.close();
    }
    await context.close();
  }
} finally {
  await browser.close(); await writeFile(resolve(output, 'raw.json'), JSON.stringify({ environment, rows }, null, 2));
}
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const summary = [];
for (const width of [1440, 390]) for (const variant of ['reference', 'integrated']) {
  const group = rows.filter(row => row.width === width && row.variant === variant);
  summary.push({ width, variant, trials: group.length, medianFrame: median(group.map(row => row.medianMs)), medianP95: median(group.map(row => row.p95Ms)), longFrames: group.reduce((sum, row) => sum + row.longFrames, 0), maxCLS: Math.max(...group.map(row => row.cls)), medianTaskMs: median(group.map(row => row.taskMs)), medianStyleMs: median(group.map(row => row.styleMs)) });
}
await writeFile(resolve(output, 'summary.json'), JSON.stringify({ environment, summary }, null, 2));
console.log(JSON.stringify(summary));
