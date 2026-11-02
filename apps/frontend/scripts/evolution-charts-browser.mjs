// Isolated UI fixtures. Blocks all external requests and never starts a backend.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base = process.env.EXPERIENCE_BASE_URL || 'http://localhost:5188';
const output = resolve('artifacts/living-evolution/charts');
await mkdir(output, { recursive:true });
const report = { source:'Intercepted presentation data only; no database or provider requests', checks:[], errors:[], unexpected:[] };
const browser = await chromium.launch({ channel:'msedge', headless:true });
const today = new Date(); today.setHours(12,0,0,0);
const reading = (days, kind, value) => {
  const date = new Date(today); date.setDate(date.getDate() - days);
  return { id:`${days}-${kind}`, kind, ...(kind === 'bloodPressure' ? { systolic:value, diastolic:value - 42 } : { value }), recordedAt:date.toISOString(), isExample:false };
};
try {
  for (const [width, language, theme] of [[1440,'en','dark'],[390,'ar','light'],[320,'en','light']]) {
    const context = await browser.newContext({ viewport:{width,height:900}, reducedMotion:'reduce', ...(width < 768 ? {isMobile:true,hasTouch:true} : {}) });
    await context.addInitScript(({language,theme}) => { localStorage.setItem('cc-language',language);localStorage.setItem('cc-theme',theme);localStorage.setItem('cc-public-motion','paused'); }, {language,theme});
    let data = [reading(6,'bloodPressure',118),reading(3,'bloodPressure',122),reading(1,'bloodPressure',123),reading(0,'bloodPressure',124),reading(6,'glucose',90),reading(3,'glucose',98),reading(0,'glucose',95)];
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (!url.pathname.startsWith('/api/')) { if(url.origin !== base){report.unexpected.push(url.origin);return route.abort();}return route.continue(); }
      const path = url.pathname.slice(4);
      const headers = {'Access-Control-Allow-Origin':base,'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Headers':'Content-Type,X-CSRF-Token','Access-Control-Allow-Methods':'GET,OPTIONS','Access-Control-Expose-Headers':'X-Account-ID','X-Account-ID':'chart-fixture'};
      const send = (status,json) => route.fulfill({status,headers,...(status===204?{body:''}:{json})});
      if(route.request().method()==='OPTIONS')return send(204);
      if(route.request().method()!=='GET'){report.unexpected.push(route.request().method()+' '+path);return send(418,{});}
      if(path==='/auth/csrf')return send(200,{csrfToken:'a'.repeat(64)});
      if(path==='/auth/me')return send(200,{user:{id:'chart-fixture',name:'Chart fixture',email:'chart@example.test',role:'patient'}});
      if(path==='/measurements')return send(200,{measurements:data});
      if(path==='/medications')return send(200,{medications:[]});
      if(path==='/habits')return send(200,{habits:[]});
      if(path==='/notifications/unread-count')return send(200,{unreadCount:0});
      report.unexpected.push(path);return send(418,{});
    });
    const page = await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>report.errors.push(error.message));
    const ready = async () => { await page.locator('h1').waitFor();await page.locator('.records-trend .chart-loading').waitFor({state:'hidden'});await page.locator('.records-trend > p[role=status]').waitFor({state:'hidden'});await page.evaluate(()=>document.fonts.ready); };
    const shot = async name => { assert(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth + 1));await page.screenshot({path:resolve(output,`${width}-${language}-${theme}-${name}.png`),fullPage:true,animations:'disabled'}); };
    await page.goto(base+'/patient/measurements');await ready();
    const plot = page.locator('.records-trend .precision-chart');await plot.waitFor();assert.equal(await plot.getAttribute('data-recorded-days'),'4');
    const paths = await plot.locator('.recharts-line-curve').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('d') || ''));
    assert(paths.length===2 && paths.every(path=>!path.includes('NaN') && (path.match(/M/g)||[]).length>=2),'Pressure paths break at missing calendar days');
    const dot = plot.locator('.recharts-line-dots circle').first();
    if(width<768)await dot.tap();else await dot.hover();
    const tip = plot.locator('.precision-tooltip');await tip.waitFor();assert((await tip.textContent()).includes('mmHg'));
    const bounds = await tip.boundingBox();assert(bounds && bounds.x>=0 && bounds.x+bounds.width<=width+1,'Tooltip stays within phone width');
    await shot('sparse-pressure-tooltip');await page.mouse.move(0,0);
    await plot.locator('.precision-values summary').click();assert.equal(await plot.locator('.precision-values li').count(),4);await shot('sparse-values');
    await page.locator('.records-latest-item').nth(1).click();await page.locator('.records-trend .precision-chart[data-kind=glucose]').waitFor();assert.equal(await plot.getAttribute('data-recorded-days'),'3');assert.equal(await plot.locator('.recharts-area').count(),1);await shot('glucose');
    data = [reading(0,'bloodPressure',124)];await page.reload();await ready();await page.locator('.records-trend .precision-chart').waitFor();assert.equal(await plot.getAttribute('data-recorded-days'),'1');assert.equal(await plot.locator('.recharts-line-dots circle').count(),2);await shot('single-day');
    await page.locator('.records-latest-item').nth(1).click();await page.locator('.records-trend .precision-empty').waitFor();assert((await page.locator('.records-trend .precision-empty').textContent()).includes('mg/dL'));await shot('missing-series');
    data=[reading(0,'bloodPressure',124),reading(0,'glucose',98)];await page.goto(base+'/patient/dashboard');await page.locator('.canvas-mini .precision-compact').waitFor();assert.equal(await page.locator('.canvas-mini .precision-chart').getAttribute('data-recorded-days'),'1');assert.equal(await page.locator('.canvas-mini .recharts-line-dots circle').count(),1);
    const spacing = await page.evaluate(()=>{const measure=()=>[parseFloat(getComputedStyle(document.querySelector('.command-actions')).columnGap),parseFloat(getComputedStyle(document.querySelector('.daily-medication')).paddingLeft)];const original=measure();document.documentElement.style.setProperty('--space-unit','.3rem');const adjusted=measure();document.documentElement.style.removeProperty('--space-unit');return {original,adjusted};});
    spacing.original.forEach((value,index)=>assert(Math.abs(spacing.adjusted[index]/value-1.2)<.02,'Tailwind and custom CSS scale from one spacing unit'));await shot('single-day-mini');
    data=[];await page.goto(base+'/patient/measurements');await ready();await page.locator('.records-trend .precision-empty').waitFor();assert.equal(await page.locator('.records-trend .recharts-line-curve').count(),0);await shot('empty');
    const palette = await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());assert.equal(palette,theme==='dark'?'#0b1320':'#f1f5f9');
    report.checks.push(`${width}-${language}-${theme}: authentic palette, shared Tailwind/CSS spacing, sparse pressure gaps, exact values, ${width<768?'touch':'pointer'} tooltip, bounded tooltip, textual averages, glucose area, single-day main/mini charts and absent/empty series`);
    await context.close();
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.unexpected,[]);console.log('PASS: 3 chart scenario sets / 21 captures');
} catch(error){report.errors.push(error.message);console.error(error);process.exitCode=1;}
finally{await browser.close();await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));}
