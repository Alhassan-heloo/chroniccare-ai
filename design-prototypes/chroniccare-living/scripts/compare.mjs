// Compose real before/after browser screenshots; no generated artwork or mocks.
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const root=fileURLToPath(new URL('..',import.meta.url));
const before=resolve(root,'../chroniccare-living-2.0-reference-20261023/before-screenshots');
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
  for(const screen of ['home','dashboard']) {
    const name=`ar-dark-1440-${screen}-viewport.png`;
    const a=await readFile(resolve(before,name)),b=await readFile(resolve(root,'artifacts',name));
    const page=await browser.newPage({viewport:{width:1480,height:590},deviceScaleFactor:1});
    await page.setContent(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Living Interface comparison</title><style>body{margin:0;padding:16px;background:#eef2f7;color:#142638;font:14px Arial,sans-serif}header{display:flex;justify-content:space-between;margin:0 0 12px}main{display:grid;grid-template-columns:1fr 1fr;gap:16px}figure{margin:0}figcaption{font-size:12px;margin-bottom:8px}img{display:block;width:100%;border-radius:10px;border:1px solid #9baabd;box-sizing:border-box}</style><header><strong>ChronicCare Living / ${screen}</strong><span>Actual Edge screenshots · Arabic · Dark · 1440px</span></header><main><figure><figcaption>01 / Approved Living 2.0</figcaption><img alt="Approved Living 2.0 ${screen}" src="data:image/png;base64,${a.toString('base64')}"></figure><figure><figcaption>02 / Refined Living</figcaption><img alt="Refined Living ${screen}" src="data:image/png;base64,${b.toString('base64')}"></figure></main></html>`);
    await page.locator('img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
    await page.screenshot({path:resolve(root,`artifacts/comparison-${screen}.png`),fullPage:true});
    await page.close();
  }
  console.log('PASS: comparison-home.png and comparison-dashboard.png from actual before/after browser captures.');
} finally {await browser.close();}
