// Offline review of actual Edge screenshots. No application or provider requests.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const root = resolve('artifacts/living-evolution');
const before = (await readdir(resolve(root, 'before'))).filter(name => name.endsWith('.png'));
const after = new Set(await readdir(resolve(root, 'after')));
const names = before.filter(name => after.has(name)).sort();
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const options = names.map(name => `<option value="${escape(name)}">${escape(name.replace('.png', ''))}</option>`).join('');
await writeFile(resolve(root, 'comparison.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ChronicCare AI — Living Evolution review</title><style>body{margin:0;padding:24px;background:#f1f5f9;color:#182c42;font:16px/1.7 Arial,sans-serif}h1{font-size:28px;margin:0}p{max-width:85ch;color:#496078}select{padding:12px;max-width:100%;background:white;border:1px solid #a7b8ca;border-radius:8px;font:inherit}main{display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start}figure{margin:20px 0;min-width:0}figcaption{font-weight:bold;margin-bottom:10px}img{display:block;width:100%;border:1px solid #d3dee9}a{color:#315fb5}@media(max-width:700px){body{padding:16px}main{grid-template-columns:1fr}}</style><h1>ChronicCare AI — Living Evolution — visual review</h1><p>Matching before/after captures from the actual React application. 1440px English dark and 390px Arabic light; the same isolated demonstration accounts and API fixtures. No real patient data, database writes, AI calls or push deliveries. Select a route to inspect the complete screenshot at its original resolution.</p><label for="capture">Page and viewport </label><select id="capture">${options}</select><main><figure><figcaption>Before · Rejected ChronicCare 4.0</figcaption><a id="beforeLink"><img id="before" alt="Application before redesign"></a></figure><figure><figcaption>After · Living Evolution</figcaption><a id="afterLink"><img id="after" alt="Application after redesign"></a></figure></main><script>const capture=document.getElementById('capture');function update(){for(const stage of ['before','after']){const path=stage+'/'+capture.value;document.getElementById(stage).src=path;document.getElementById(stage+'Link').href=path}}capture.value='1440-en-dark-_patient_dashboard.png';capture.onchange=update;update();</script></html>`);
const groups = [ ['Homepage', '_'], ['Patient dashboard', '_patient_dashboard'], ['Measurements', '_patient_measurements'], ['Habits', '_patient_habits'], ['Doctor workspace', '_doctor_dashboard'], ['Admin workspace', '_admin_dashboard'], ['AI assistant', '_patient_assistant'] ];
const figures = [];
for (const [label, route] of groups) {
  figures.push(`<h2>${label}</h2>`);
  for (const [width, locale, theme] of [[1440,'en','dark'],[390,'ar','light']]) for (const stage of ['before','after']) {
    const file = `${width}-${locale}-${theme}-${route}.png`;
    const bytes = await readFile(resolve(root, stage, file));
    figures.push(`<figure class="${width === 390 ? 'phone' : 'desktop'}"><figcaption>${stage} · ${width}px · ${locale} · ${theme}</figcaption><div class="thumbnail"><img src="data:image/png;base64,${bytes.toString('base64')}" alt="${label} ${stage}"></div></figure>`);
  }
}
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const browser = await chromium.launch({ channel:'msedge', headless:true });
try {
  const page = await browser.newPage({ viewport:{width:1600,height:1000}, deviceScaleFactor:1 });
  await page.setContent(`<html><style>body{margin:0;padding:24px;background:#f1f5f9;color:#182c42;font:14px/1.6 Arial}h1{margin:0 0 4px}p{margin:0 0 20px}main{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,.55fr) minmax(0,.55fr);gap:12px 20px}h2{grid-column:1/-1;margin:12px 0 0;font-size:20px}figure{margin:0;min-width:0}figcaption{padding:6px 0;color:#496078}.thumbnail{height:300px;overflow:hidden;border:1px solid #d3dee9;background:#e1ebf3}.phone .thumbnail{width:122px;margin:auto}img{width:100%;height:auto;display:block}</style><h1>ChronicCare AI — Living Evolution</h1><p>Actual application captures · first desktop/phone viewport · isolated fixtures · open comparison.html for complete pages</p><main>${figures.join('')}</main></html>`);
  await page.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
  await page.screenshot({ path:resolve(root,'comparison-overview.png'),fullPage:true });
} finally { await browser.close(); }
console.log(`PASS: ${names.length} matching comparisons and 7 desktop/mobile comparison rows`);
