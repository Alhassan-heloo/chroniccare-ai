// Build an offline comparison and browser-rendered contact sheets from actual captures.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const root = resolve('artifacts/experience');
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
try {
  for (const stage of ['before', 'after']) {
    const files = (await readdir(resolve(root, stage))).filter(name => name.startsWith('1440-') && name.endsWith('.png'));
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const figures = await Promise.all(files.map(async name => `<figure><figcaption>${escape(name.replace('1440-en-dark-', ''))}</figcaption><img src="data:image/png;base64,${(await readFile(resolve(root, stage, name))).toString('base64')}" /></figure>`));
    await page.setContent(`<html><style>body{margin:0;padding:16px;background:#edf1f5;font:14px Arial}main{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}figure{margin:0;min-width:0}figcaption{padding:8px;overflow-wrap:anywhere}img{width:100%;height:250px;object-fit:cover;object-position:top;border-radius:8px}</style><h1>Living 3.3 / ${stage} / all routes</h1><main>${figures.join('')}</main></html>`);
    await page.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
    await page.screenshot({ path: resolve(root, `${stage}-inventory.png`), fullPage: true }); await page.close();
  }
  const names = (await readdir(resolve(root, 'after'))).filter(name => /^(1440|390)-/.test(name) && name.endsWith('.png'));
  const options = names.map(name => `<option value="${escape(name)}">${escape(name.slice(0, -4))}</option>`).join('');
  await writeFile(resolve(root, 'comparison.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><title>ChronicCare AI — Living 3.3 review</title><style>body{margin:0;padding:24px;background:#0b1320;color:#f7faff;font:16px/1.8 Arial}p{color:#bac8da;max-width:80ch}select{max-width:100%;padding:12px;color:inherit;background:#162437;border:1px solid #50647b;border-radius:12px}main{display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start}figure{margin:20px 0}img{width:100%;border-radius:12px}a{color:#69e1d7}@media(max-width:800px){main{grid-template-columns:1fr}}</style><h1>Living 3.3 — application experience review</h1><p>Actual Edge screenshots. Account and health data are isolated browser fixtures. No database or AI provider calls. Compare the preserved product foundations and refined clinical, connection and account experiences.</p><label for="capture">Page, width, language and appearance </label><select id="capture">${options}</select><main><figure><figcaption>Before</figcaption><a id="beforeLink"><img id="before" alt="Before refinement" /></a></figure><figure><figcaption>After</figcaption><a id="afterLink"><img id="after" alt="After refinement" /></a></figure></main><script>const capture=document.getElementById('capture');function update(){for(const stage of ['before','after']){const path=stage+'/'+capture.value;document.getElementById(stage).src=path;document.getElementById(stage+'Link').href=path}}capture.onchange=update;update();</script></html>`);
  console.log('PASS: offline comparison and 2 browser-rendered route inventories');
} finally { await browser.close(); }
