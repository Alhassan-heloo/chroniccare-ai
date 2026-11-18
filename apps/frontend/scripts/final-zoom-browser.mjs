// Actual Edge zoom in an isolated profile; uses synthetic accounts in the live demo.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp,readFile,writeFile } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)),output=resolve(root,'artifacts/final-experience');
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const access=await readFile(resolve(output,'DEMO-ACCESS.md'),'utf8');
const password=access.match(/كلمة مرور حسابات العرض: (.+)/)[1].trim();
const emails=Object.fromEntries(['patient','doctor','admin'].map(role=>[role,access.match(new RegExp('^\\| '+role+' \\| (.*?) \\|$','m'))[1]]));
const base='http://127.0.0.1:5197';const report={mode:'Actual Edge default zoom, isolated disposable browser profile and synthetic PostgreSQL demo accounts.',checks:[],screenshots:[],errors:[]};
let context,settings;
try{
  const profile=await mkdtemp(join(tmpdir(),'chroniccare-zoom-'));
  context=await chromium.launchPersistentContext(profile,{channel:'msedge',headless:true,viewport:null,args:['--window-size=1440,1000']});
  await context.addInitScript(()=>{try{localStorage.setItem('cc-language','ar');if(!localStorage.getItem('cc-theme'))localStorage.setItem('cc-theme','light');}catch{}});
  const page=await context.newPage();settings=await context.newPage();await settings.goto('edge://settings/appearance',{waitUntil:'domcontentloaded'});
  await settings.waitForFunction(()=>typeof globalThis.chrome?.settingsPrivate?.getDefaultZoom==='function');
  await settings.evaluate(()=>new Promise(resolve=>globalThis.chrome.settingsPrivate.setDefaultZoom(1,resolve)));
  await page.goto(base+'/login',{waitUntil:'domcontentloaded'});const before=await page.evaluate(()=>({width:innerWidth,dpr:devicePixelRatio,fontSize:getComputedStyle(document.documentElement).fontSize}));
  await settings.evaluate(()=>new Promise(resolve=>globalThis.chrome.settingsPrivate.setDefaultZoom(2,resolve)));
  const zoom=await settings.evaluate(()=>new Promise(resolve=>globalThis.chrome.settingsPrivate.getDefaultZoom(resolve)));assert.equal(zoom,2);
  await page.reload({waitUntil:'domcontentloaded'});const after=await page.evaluate(()=>({width:innerWidth,dpr:devicePixelRatio,fontSize:getComputedStyle(document.documentElement).fontSize}));
  assert(after.width<=before.width*.55,'Browser zoom halves CSS viewport');assert(after.dpr/before.dpr>=1.9,'Browser zoom doubles CSS pixel scale');assert.equal(after.fontSize,before.fontSize,'Root text size was not modified');report.metrics={zoom,before,after};
  for(const role of ['patient','doctor','admin']){
    await context.clearCookies();await page.goto(base+'/login',{waitUntil:'domcontentloaded'});await page.locator('input[type=email]').fill(emails[role]);await page.locator('input[autocomplete=current-password]').fill(password);await page.locator('.auth-card form button[type=submit]').click();
    await page.waitForURL(url=>url.pathname===`/${role}/dashboard`);
    if(role==='patient'){await page.locator('.canvas-readings').waitFor();await page.locator('.chart-loading').waitFor({state:'hidden'});await page.locator('.dashboard-record-pressure').focus();assert.equal(await page.locator('.dashboard-record-pressure').evaluate(el=>getComputedStyle(el).outlineWidth),'3px');}
    if(role==='doctor'){await page.locator('.doctor-selection-list a').first().click();await page.locator('.doctor-record-title').waitFor();}
    if(role==='admin')await page.locator('.admin-open-create').click();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Actual zoom fits '+role);
    const path=resolve(output,`browser-zoom-${role}-ar-200.png`);await page.screenshot({path,fullPage:false,timeout:60000});report.screenshots.push(path);report.checks.push(role+': actual 200% browser zoom, no horizontal overflow'+(role==='patient'?', visible keyboard focus':''));
  }
  report.status='PASS';console.log(JSON.stringify({status:'PASS',metrics:report.metrics,checks:report.checks.length}));
}catch(error){report.status='FAIL';let message=String(error.message).replaceAll(password,'[redacted]');for(const email of Object.values(emails))message=message.replaceAll(email,'[email]');report.errors.push(message);console.error(JSON.stringify({status:'FAIL',error:message}));process.exitCode=1;}
finally{if(settings)await settings.evaluate(()=>new Promise(resolve=>globalThis.chrome.settingsPrivate.setDefaultZoom(1,resolve))).catch(()=>{});if(context){await context.clearCookies();await context.close();}await writeFile(resolve(output,'browser-zoom-report.json'),JSON.stringify(report,null,2));}
