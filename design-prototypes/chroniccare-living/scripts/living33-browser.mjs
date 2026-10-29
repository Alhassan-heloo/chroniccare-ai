import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {runInteractions} from './living31-browser.mjs';
import {storyChecks} from './living32-browser.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const phase=process.argv.includes('--before')?'before':'after';
const output=fileURLToPath(new URL(`../artifacts/living-3.3/${phase}/`,import.meta.url));
const browser=await chromium.launch({channel:'msedge',headless:true});
await mkdir(output,{recursive:true});
const base='http://127.0.0.1:5206/'+(phase==='before'?'?baseline=1':''),errors=[],cases=[];
const activate=async locator=>{await locator.focus();await locator.press('Enter');};
async function geometry(page){return page.evaluate(()=>({width:innerWidth,height:innerHeight,language:document.documentElement.lang,direction:document.documentElement.dir,theme:document.documentElement.dataset.theme,overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),cairo:document.fonts.check('16px Cairo'),rows:document.querySelectorAll('.reading-table tbody tr').length,containers:[...document.querySelectorAll('.topbar,.health-canvas,.canvas-readout,.daily-orbit,.workspace-dock,.habit-actions,.dose-row,.reading-value,.latest-glucose strong')].filter(el=>el.getBoundingClientRect().width>0).map(el=>({name:el.className,overflow:Math.max(0,el.scrollWidth-el.clientWidth)})),smallText:[...document.querySelectorAll('.habit-undo,.dose-time,.dose-action,.brand small,.canvas-name')].map(el=>({name:el.className||el.tagName,size:getComputedStyle(el).fontSize,color:getComputedStyle(el).color,opacity:getComputedStyle(el).opacity,disabled:el.matches(':disabled'),text:el.textContent})),unnamedButtons:[...document.querySelectorAll('button')].filter(el=>!el.textContent?.trim()&&!el.getAttribute('aria-label')&&!el.getAttribute('aria-labelledby')).map(el=>el.className)}));}
async function reveal(page){
  for(let top=0;top<await page.evaluate(()=>document.documentElement.scrollHeight);top+=650){await page.evaluate(top=>scrollTo({top,behavior:'instant'}),top);await page.waitForTimeout(65);}
  await page.waitForTimeout(700);await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(700);
}
async function preferences(page,language,theme){
  if(await page.locator('html').getAttribute('lang')!==language)await activate(page.locator('.language-toggle'));
  if(await page.locator('html').getAttribute('data-theme')!==theme)await activate(page.locator('.theme-toggle'));
}
try{
  const context=await browser.newContext({viewport:{width:1440,height:960}}),page=await context.newPage();
  page.on('pageerror',error=>errors.push(String(error)));page.on('console',msg=>{if(['warning','error'].includes(msg.type()))errors.push({text:msg.text(),location:msg.location()});});
  await page.goto(base);await page.evaluate(()=>document.fonts.ready);
  for(const [width,height] of [[1440,960],[768,1024],[390,844],[320,740]]){
    await page.setViewportSize({width,height});
    for(const language of ['ar','en'])for(const theme of ['dark','light']){
      await preferences(page,language,theme);await activate(page.locator('.brand'));await page.locator('main h1').focus();await reveal(page);
      const name=`${width}-${language}-${theme}`,home=await geometry(page);
      await page.screenshot({path:`${output}/${name}-home.png`,fullPage:true});
      await activate(page.locator('.enter-space'));await page.waitForTimeout(750);
      const dashboard=await geometry(page);
      await page.screenshot({path:`${output}/${name}-dashboard.png`,fullPage:true});
      cases.push({name,home,dashboard});
      if(phase==='after')for(const state of [home,dashboard]){assert.equal(state.overflow,0,`${name} document overflow`);assert(state.containers.every(row=>row.overflow<=1),JSON.stringify({name,containers:state.containers}));assert.equal(state.direction,language==='ar'?'rtl':'ltr');assert(state.cairo);assert.equal(state.rows,7);assert.equal(state.unnamedButtons.length,0);}
      console.log('CAPTURE',phase,name,JSON.stringify({homeOverflow:home.overflow,dashboardOverflow:dashboard.overflow}));
    }
  }
  await writeFile(`${output}/matrix.json`,JSON.stringify({phase,browser:await browser.version(),cases,errors},null,2));
  await preferences(page,'en','light');await page.setViewportSize({width:320,height:740});
  await activate(page.locator('.dock-add'));await page.locator('input[name=systolic]').fill('9999');await page.locator('input[name=diastolic]').fill('9998');await activate(page.locator('button[type=submit]'));await page.waitForTimeout(700);
  const high=await geometry(page);await page.screenshot({path:`${output}/320-en-light-high-reading.png`,fullPage:true});
  await writeFile(`${output}/high-reading.json`,JSON.stringify(high,null,2));
  if(phase==='after'){assert.equal(high.overflow,0);assert(high.containers.every(row=>row.overflow<=1));}
  if(phase==='after'){
    await page.reload();await page.evaluate(()=>document.fonts.ready);
    const tab={playwright:page,url:()=>page.url(),reload:()=>page.reload(),pressKey:(_target,key)=>page.keyboard.press(key),screenshot:options=>page.screenshot(options),dev:{logs:async()=>errors}};
    const viewport={set:size=>page.setViewportSize(size)};
    const interactions=await runInteractions({tab,viewport,output});const story=await storyChecks({tab,viewport,output});
    for(const reducedMotion of ['reduce','no-preference']){await page.emulateMedia({reducedMotion});await page.waitForFunction(reduced=>document.querySelector('.motion-toggle').disabled===reduced,reducedMotion==='reduce');assert.equal(await page.locator('.living-app').getAttribute('data-motion'),reducedMotion==='reduce'?'paused':'running');}
    await writeFile(`${output}/regressions.json`,JSON.stringify({interactions,story,errors},null,2));assert.equal(errors.length,0,JSON.stringify(errors));
  }
  await context.close();
}finally{await browser.close();}
