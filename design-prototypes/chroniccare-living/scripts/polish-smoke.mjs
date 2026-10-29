import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const root=fileURLToPath(new URL('..',import.meta.url)),output=resolve(root,'artifacts/polish');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),report={cases:[],errors:[],console:[]};let current;
try {
  for(const [lang,theme,width] of [['ar','dark',1440],['ar','dark',320],['en','light',390]]) {
    const height=width===1440?960:width===320?740:844;
    const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
    await context.addInitScript(({lang,theme})=>{localStorage.setItem('cc-living-language',lang);localStorage.setItem('cc-living-theme',theme);},{lang,theme});
    const page=await context.newPage(),tag=`${lang}-${theme}-${width}`;current=page;
    page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(['warning','error'].includes(m.type()))report.console.push(m.text());});
    await page.goto('http://127.0.0.1:5205/');await page.locator('main h1').waitFor();await page.evaluate(()=>document.fonts.ready);
    await page.screenshot({path:resolve(output,tag+'-home.png'),fullPage:true});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    if(width===1440)assert(await page.locator('.enter-space').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight));
    const help=page.locator('.health-canvas .context-help');await help.locator('summary').click();assert.equal(await help.getAttribute('open'),'');
    await page.waitForFunction(()=>document.querySelector('.health-canvas .context-help')?.dataset.side);
    assert(await help.locator('.help-bubble').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}));
    await page.keyboard.press('Escape');assert.equal(await help.getAttribute('open'),null);assert(await help.locator('summary').evaluate(el=>el===document.activeElement));
    await page.locator('.experience-index button').nth(2).click();await page.waitForFunction(()=>document.querySelector('.experience-index [aria-current=location]')?.getAttribute('aria-controls')==='habits-scene');
    const afterClick=page.url();
    await page.evaluate(()=>{const el=document.getElementById('report-scene');window.scrollTo({top:scrollY+el.getBoundingClientRect().top-document.querySelector('.topbar').getBoundingClientRect().bottom-24,behavior:'instant'});});
    await page.waitForFunction(()=>document.querySelector('.experience-index [aria-current=location]')?.getAttribute('aria-controls')==='report-scene');assert.equal(page.url(),afterClick);
    const ledger=page.locator('.report-sheet .report-details');assert.equal(await ledger.getAttribute('open'),null);await ledger.locator('summary').click();await page.locator('.report-sheet .ledger-row').first().waitFor();assert.equal(await page.locator('.report-sheet .ledger-row').count(),7);
    await page.locator('.report-sheet .report-toolbar select').selectOption('3');assert.equal(await page.locator('.report-sheet .ledger-row').count(),3);
    await page.locator('.enter-space').click();await page.waitForURL('**/#dashboard');await page.locator('.dashboard-experience').waitFor();
    assert.equal(await page.locator('.daily-orbit .habit-ring').first().getAttribute('aria-valuenow'),'6');
    await page.locator('.daily-orbit .water-action').click();assert.equal(await page.locator('.daily-orbit .habit-ring').first().getAttribute('aria-valuenow'),'7');await page.locator('.daily-orbit .habit-undo').first().click();assert.equal(await page.locator('.daily-orbit .habit-ring').first().getAttribute('aria-valuenow'),'6');assert(await page.locator('.daily-orbit .habit-undo').first().isDisabled());
    await page.locator('.daily-orbit .steps-action').click();assert.equal(await page.locator('.daily-orbit .habit-ring').last().getAttribute('aria-valuenow'),'5000');await page.locator('.daily-orbit .habit-undo').last().click();assert.equal(await page.locator('.daily-orbit .habit-ring').last().getAttribute('aria-valuenow'),'4500');
    await page.evaluate(()=>{const el=document.getElementById('dashboard-routine');window.scrollTo({top:scrollY+el.getBoundingClientRect().top-document.querySelector('.topbar').getBoundingClientRect().bottom-24,behavior:'instant'});});
    await page.waitForFunction(()=>document.querySelector('.workspace-dock [aria-current=location]')?.getAttribute('aria-label')===document.getElementById('dashboard-routine').getAttribute('aria-label'));
    const route=page.url();await page.locator('.language-toggle').click();await page.locator('.theme-toggle').click();assert.equal(page.url(),route);assert.equal(await page.locator('.daily-orbit .habit-ring').last().getAttribute('aria-valuenow'),'4500');
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:resolve(output,tag+'-dashboard.png'),fullPage:true});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    report.cases.push({lang,theme,width,height,status:'PASS',checks:['help touch/keyboard/Escape/focus and viewport fit','home scrollspy and unchanged route','expanded report/period','habit rings and one-step undo','dashboard manual scrollspy','theme/language state preservation','overflow']});
    await context.close();
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.console,[]);
  console.log(JSON.stringify({status:'PASS',suites:report.cases.length,output}));
} catch(error){report.errors.push(error.stack);if(current&&!current.isClosed())await current.screenshot({path:resolve(output,'failure.png'),fullPage:true});throw error;} finally {await browser.close();await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));}
