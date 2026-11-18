import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
const root=fileURLToPath(new URL('..',import.meta.url));const base='http://127.0.0.1:5189';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const output=resolve(root,'artifacts/final-experience/homepage');await mkdir(output,{recursive:true});
const vite=await createServer({root,cacheDir:resolve(root,'node_modules/.vite-final-homepage'),logLevel:'error',server:{host:'127.0.0.1',port:5189,strictPort:true}});await vite.listen();
const report={mode:'Mocked guest session. No real service calls.',checks:[],screenshots:[],errors:[]};let browser;
try{
  process.env.HOMEPAGE_BASE_URL=base;process.env.HOMEPAGE_OUTPUT=output;
  await import('./homepage-navigation-browser.mjs');
  report.checks.push('Existing homepage navigation suite passed for every role, locale, theme, breakpoint and keyboard focus transition');
  browser=await chromium.launch({channel:'msedge',headless:true});
  for(const theme of ['light','dark']){
    const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
    await context.addInitScript(({theme})=>{try{localStorage.setItem('cc-language','ar');localStorage.setItem('cc-theme',theme);}catch{}},{theme});
    await context.route(/^https?:\/\/[^/]+\/api\//,route=>route.fulfill({status:401,json:{error:{code:'UNAUTHENTICATED'}}}));
    const page=await context.newPage();page.on('pageerror',error=>report.errors.push(error.message));await page.goto(base+'/');await page.locator('.show-card').first().click();await page.locator('.show-dialog[open]').waitFor();
    await page.evaluate(()=>document.fonts.ready);const size=await page.locator('.show-dialog').boundingBox();assert(size.height<844*.92,'Short-content dialog fits its content instead of filling mobile viewport');
    let path=resolve(output,`gallery-ar-${theme}-390.png`);await page.screenshot({path});report.screenshots.push(path);
    await page.addStyleTag({content:'.show-dialog .feature-copy > p{font-size:32px!important}'});await page.setViewportSize({width:320,height:568});
    const body=page.locator('.feature-body');assert(await body.evaluate(el=>el.scrollHeight>el.clientHeight),'Enlarged text scrolls within dialog');await body.evaluate(el=>{el.scrollTop=el.scrollHeight;});
    assert(await page.locator('.feature-header button').isVisible(),'Close remains visible while body scrolls');path=resolve(output,`gallery-ar-${theme}-320-text200.png`);await page.screenshot({path});report.screenshots.push(path);await page.keyboard.press('Escape');assert.equal(await page.locator('.show-dialog[open]').count(),0);
    report.checks.push(`Gallery ${theme}: short-content sizing, scrollable enlarged text, visible close, keyboard Escape`);await context.close();
  }
  assert.deepEqual(report.errors,[]);report.status='PASS';console.log(JSON.stringify({status:report.status,checks:report.checks.length}));
}catch(error){report.status='FAIL';report.errors.push(error.message);throw error;}
finally{if(browser)await browser.close();await vite.close();await writeFile(resolve(output,'gallery-report.json'),JSON.stringify(report,null,2));}
