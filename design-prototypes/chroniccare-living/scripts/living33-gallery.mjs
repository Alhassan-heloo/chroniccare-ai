// Evidence viewer only. It displays real captured PNGs without changing their content.
import {writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const directory=new URL('../artifacts/living-3.3/',import.meta.url),gallery=new URL('comparison.html',directory);
await writeFile(gallery,`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Living 3.2.1 / 3.3 — مقارنة فعلية</title>
<style>*{box-sizing:border-box}body{margin:0;background:#0b1320;color:#f7faff;font:16px/1.8 system-ui,sans-serif}header{padding:20px 28px;border-bottom:1px solid #50647b}h1{font-size:23px;margin:0}p{color:#bac8da;margin:6px 0}nav{display:flex;gap:12px;flex-wrap:wrap;margin-top:16px}label{display:flex;gap:8px;align-items:center}select{font:inherit;background:#162437;color:#f7faff;padding:8px;border:1px solid #50647b;border-radius:8px}main{display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:20px;direction:ltr}section{text-align:center;min-width:0}h2{font-size:18px;margin:0 0 12px}a{display:block;color:#69e1d7;font-size:14px}img{display:block;max-width:100%;height:auto;margin:12px auto;border:1px solid #50647b;border-radius:8px}@media(max-width:700px){main{grid-template-columns:1fr}}</style>
<header><h1>Living 3.2.1 ← Living 3.3</h1><p>مقارنة لقطات Production الفعلية. لم تُرسم واجهات بديلة ولم تُعدّل محتويات الصور. اضغط الرابط لفتح دقة الالتقاط الأصلية.</p><nav>
<label>العرض <select id="width"><option>1440</option><option>768</option><option>390</option><option>320</option></select></label><label>اللغة <select id="language"><option value="ar">العربية</option><option value="en">English</option></select></label><label>المظهر <select id="theme"><option value="dark">Dark</option><option value="light">Light</option></select></label><label>الصفحة <select id="route"><option value="home">الرئيسية</option><option value="dashboard">لوحة المريض</option></select></label></nav></header>
<main><section><h2>قبل — Living 3.2.1</h2><a id="before-link">الصورة الأصلية</a><img id="before" alt="لقطة الإنتاج قبل التعديل"></section><section><h2>بعد — Living 3.3</h2><a id="after-link">الصورة الأصلية</a><img id="after" alt="لقطة الإنتاج بعد التعديل"></section></main>
<script>function update(){const name=['width','language','theme','route'].map(id=>document.getElementById(id).value).join('-')+'.png';for(const phase of ['before','after']){document.getElementById(phase).src=phase+'/'+name;document.getElementById(phase+'-link').href=phase+'/'+name;}}for(const select of document.querySelectorAll('select'))select.addEventListener('change',update);update();</script></html>`);
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:960}});await page.goto(gallery.href);
  for(const width of ['1440','390'])for(const theme of ['dark','light'])for(const route of ['home','dashboard']){
    await page.locator('#width').selectOption(width);await page.locator('#theme').selectOption(theme);await page.locator('#route').selectOption(route);
    await page.waitForFunction(()=>[...document.images].every(image=>image.complete&&image.naturalWidth>0));
    await page.screenshot({path:fileURLToPath(new URL(`comparison-${width}-ar-${theme}-${route}.png`,directory)),fullPage:true});
  }
  const app=await browser.newPage({viewport:{width:1440,height:960}});
  for(const width of [1440,390])for(const theme of ['dark','light']){
    await app.setViewportSize({width,height:width===1440?960:844});
    await app.goto(`http://127.0.0.1:5206/?approval=${width}-${theme}#home`);await app.evaluate(()=>document.fonts.ready);
    if(await app.locator('html').getAttribute('data-theme')!==theme)await app.locator('.theme-toggle').click();await app.waitForTimeout(1000);
    await app.screenshot({path:fileURLToPath(new URL(`after/approval-${width}-ar-${theme}-home.png`,directory))});
    await app.locator('.enter-space').click();await app.waitForTimeout(800);
    await app.screenshot({path:fileURLToPath(new URL(`after/approval-${width}-ar-${theme}-dashboard.png`,directory))});
    if(width===390){await app.locator('.workspace-dock button').nth(1).click();await app.waitForTimeout(900);await app.screenshot({path:fileURLToPath(new URL(`after/approval-${width}-ar-${theme}-routine.png`,directory))});}
  }
  console.log('PASS: comparison.html + 8 paired actual-screenshot compositions + 10 viewport approval stills.');
}finally{await browser.close();}
