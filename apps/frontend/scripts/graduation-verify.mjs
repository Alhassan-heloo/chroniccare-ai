// Live read-only layout checks. Fault injection cases are identified separately.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),output=resolve(root,'artifacts/graduation-finalization/layout');await mkdir(output,{recursive:true});
const access=await readFile(resolve(root,'artifacts/final-experience/DEMO-ACCESS.md'),'utf8'),password=access.match(/كلمة مرور حسابات العرض: (.+)/)[1].trim();
const emails=Object.fromEntries(['patient','doctor','admin','invited'].map(role=>[role,access.match(new RegExp('^\\| '+role+' \\| (.*?) \\|$','m'))[1]]));
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');const browser=await chromium.launch({channel:'msedge',headless:true});
const base='http://127.0.0.1:5197',report={mode:'Live isolated Express/PostgreSQL synthetic preview. Edge viewport emulation. Explicit response failures injected only in labelled error checks.',checks:[],screenshots:[],errors:[]};
const sessionCookies={};
async function signIn(page,role){if(sessionCookies[role]){await page.context().addCookies(sessionCookies[role]);await page.goto(base+`/${role==='invited'?'patient':role}/dashboard`,{waitUntil:"domcontentloaded"});return;}await page.goto(base+'/login',{waitUntil:'domcontentloaded'});await page.locator('input[type=email]').fill(emails[role]);await page.locator('input[autocomplete=current-password]').fill(password);await page.locator('.auth-card form button[type=submit]').click();await page.waitForURL(url=>url.pathname===`/${role==='invited'?'patient':role}/dashboard`,{waitUntil:"domcontentloaded",timeout:60000});sessionCookies[role]=await page.context().cookies();}
async function fits(page,label){const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert(!overflow,label+' fits viewport');}
async function shot(page,file){const path=resolve(output,file+'.png');await page.screenshot({path,fullPage:true,timeout:60000});report.screenshots.push(path);}
try{
 for(const language of ['ar','en'])for(const theme of ['light','dark'])for(const width of [1440,390,320]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});await context.addInitScript(({language,theme})=>{localStorage.setItem('cc-language',language);localStorage.setItem('cc-theme',theme);},{language,theme});const page=await context.newPage();page.on('pageerror',error=>report.errors.push(error.message));
  for(const role of ['patient','doctor','admin']){
   await context.clearCookies();await signIn(page,role);await page.evaluate(()=>document.fonts.ready);
   if(role==='patient'){
    await page.locator('.canvas-readings').waitFor();await page.locator('.chart-loading').waitFor({state:'hidden'});assert.equal(await page.locator('.week-days a').count(),7);
    const sizes=await page.locator('.dashboard-record-pressure,.week-days a,.patient-shortcuts a').evaluateAll(els=>els.map(el=>({w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height})));assert(sizes.every(size=>size.w>=44&&size.h>=44),'Patient primary controls are at least44 CSSpx');
    await page.locator('.dashboard-record-pressure').focus();assert.equal(await page.locator('.dashboard-record-pressure').evaluate(el=>getComputedStyle(el).outlineWidth),'3px');
    await shot(page,`${role}-${language}-${theme}-${width}`);const link=page.locator('.week-days a').first(),day=await link.getAttribute('data-day');await link.click();await page.locator('.measurement-day').waitFor();assert.equal(new URL(page.url()).searchParams.get('day'),day);assert.equal(await page.locator('.measurement-day-title time').getAttribute('datetime'),day);assert.equal(await page.locator('.measurement-day').count(),1);await fits(page,'Selected day');
    await page.goto(base+'/patient/reports?visit=1');await page.locator('.visit-summary').waitFor();await fits(page,'Visit summary');if(language==='ar'&&width===390)await shot(page,`visit-${theme}-${width}`);
   }else if(role==='doctor'){
    await page.locator('.doctor-selection-list a').first().click();await page.locator('.doctor-record-title').waitFor();await page.locator('.patient-activity [role=status]').waitFor({state:'hidden'});await page.locator('.activity-day summary').first().click();assert(await page.locator('.activity-detail').first().isVisible());assert.equal(await page.locator('.comparison-periods section').count(),2);await shot(page,`${role}-${language}-${theme}-${width}`);
   }else{
    await page.locator('.invitation-ledger summary').first().waitFor();await page.locator('.invitation-ledger summary').first().click();assert(await page.locator('.invitation-ledger-detail').first().isVisible());await shot(page,`${role}-${language}-${theme}-${width}`);await fits(page,'Invitation ledger');await page.locator('.admin-open-create').click();await fits(page,'AddDoctor');await page.keyboard.press('Escape');
   }
   await fits(page,`${role}-${language}-${theme}-${width}`);report.checks.push(`${role} ${language} ${theme} ${width}: ready content, no overflow, relevant actions`);
  }
  await context.close();
 }
 const context=await browser.newContext({viewport:{width:320,height:900},reducedMotion:'reduce'});await context.addInitScript(()=>{localStorage.setItem('cc-language','ar');localStorage.setItem('cc-theme','light');});const page=await context.newPage();await signIn(page,'invited');await page.locator('.first-reading-prompt').waitFor();await shot(page,'patient-empty-ar-light-320');await page.locator('.first-reading-prompt a').click();await page.locator('input[name=systolic]').waitFor();report.checks.push('New account: empty illustration and first reading open existing form at320');
 await context.clearCookies();await signIn(page,'doctor');await page.route('**/api/doctor/patients/*/activity?*',route=>route.fulfill({status:503,json:{error:{code:'ACTIVITY_UNAVAILABLE'}}}));await page.locator('.doctor-selection-list a').first().click();await page.locator('.patient-activity [role=alert]').waitFor();await page.locator('.activity-filters button').nth(2).click();assert(!(await page.locator('.patient-activity').innerText()).includes('لا توجد أحداث مسجلة'));await shot(page,'doctor-activity-error-ar-light-320');report.checks.push('Injected activity error stays unavailable without falsely claiming no events');
 await context.clearCookies();await page.unrouteAll();await page.route('**/api/admin/invitations',route=>route.fulfill({status:503,json:{error:{code:'INVITATIONS_UNAVAILABLE'}}}));await signIn(page,'admin');await page.locator('.admin-invitations [role=alert]').waitFor();await shot(page,'admin-ledger-error-ar-light-320');await page.unrouteAll();await page.locator('.admin-invitations [role=alert] button').click();await page.locator('.invitation-ledger').waitFor();report.checks.push('Injected invitation load failure supports successful real-service retry');await context.close();
 assert.deepEqual(report.errors,[]);report.status='PASS';console.log(JSON.stringify({status:report.status,checks:report.checks.length,screenshots:report.screenshots.length}));
}catch(error){report.status='FAIL';report.errors.push(String(error.message).replaceAll(password,'[redacted]'));console.error(JSON.stringify({status:'FAIL',error:report.errors.at(-1)}));process.exitCode=1;}finally{await browser.close();await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));}
