import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),phase=process.argv.includes('--before')?'before':'after';
const output=resolve(root,'artifacts/graduation-finalization',phase);await mkdir(output,{recursive:true});
const access=await readFile(resolve(root,'artifacts/final-experience/DEMO-ACCESS.md'),'utf8');
const password=access.match(/كلمة مرور حسابات العرض: (.+)/)[1].trim();
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const sessionCookies={};
const browser=await chromium.launch({channel:'msedge',headless:true});const shots=[];
try{for(const theme of ['light','dark'])for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
 await context.addInitScript(({theme})=>{localStorage.setItem('cc-language','ar');localStorage.setItem('cc-theme',theme);},{theme});
 const page=await context.newPage();await page.goto('http://127.0.0.1:5197',{waitUntil:'domcontentloaded'});await page.locator('#readings').scrollIntoViewIfNeeded();await page.evaluate(()=>document.fonts.ready);await page.locator('#readings').screenshot({path:resolve(output,`homepage-${theme}-${width}.png`)});shots.push(`homepage-${theme}-${width}.png`);
 for(const role of ['patient','doctor','admin']){
  await context.clearCookies();if(sessionCookies[role]){await context.addCookies(sessionCookies[role]);await page.goto(`http://127.0.0.1:5197/${role}/dashboard`,{waitUntil:'domcontentloaded'});}else{await page.goto('http://127.0.0.1:5197/login',{waitUntil:'domcontentloaded'});
  const email=access.match(new RegExp('^\\| '+role+' \\| (.*?) \\|$','m'))[1];
  await page.locator('input[type=email]').fill(email);await page.locator('input[autocomplete=current-password]').fill(password);await page.locator('.auth-card form button[type=submit]').click();await page.waitForURL(url=>url.pathname===`/${role}/dashboard`,{waitUntil:"domcontentloaded",timeout:60000});sessionCookies[role]=await context.cookies();}
  if(role==='patient'){await page.locator('.canvas-readings').waitFor();await page.locator('.chart-loading').waitFor({state:'hidden'});}
  if(role==='doctor'){await page.locator('.doctor-selection-list a').first().click();await page.locator('.doctor-record-title').waitFor();if(phase==='after')await page.locator('.patient-activity [role=status]').waitFor({state:'hidden'});}
  if(role==='admin'){await page.locator('.admin-open-create').click();await page.locator('.admin-creation-modes').waitFor();}
  await page.evaluate(()=>document.fonts.ready);const file=`${role}-${theme}-${width}.png`;await page.screenshot({path:resolve(output,file),fullPage:true,timeout:60000});shots.push(file);
 }
 await context.close();
}await writeFile(resolve(output,'report.json'),JSON.stringify({status:'PASS',mode:'Live isolated PostgreSQL preview; synthetic accounts; Edge emulated viewports',shots},null,2));console.log(JSON.stringify({phase,status:'PASS',screenshots:shots.length}));}finally{await browser.close();}
