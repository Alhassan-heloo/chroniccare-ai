import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const output=fileURLToPath(new URL('../artifacts/living-3.3/',import.meta.url)),base='http://127.0.0.1:5206/';
await mkdir(output,{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:true});
const activate=async node=>{await node.focus();await node.press('Enter');},errors=[],contrast=[],high=[],zoom=[];
async function preferences(page,language,theme){if(await page.locator('html').getAttribute('lang')!==language)await activate(page.locator('.language-toggle'));if(await page.locator('html').getAttribute('data-theme')!==theme)await activate(page.locator('.theme-toggle'));}
function watch(page){page.on('pageerror',error=>errors.push(String(error)));page.on('console',msg=>{if(['warning','error'].includes(msg.type()))errors.push(msg.text());});}
try{
  const context=await browser.newContext({viewport:{width:320,height:740}}),page=await context.newPage();watch(page);
  for(const variant of ['before','after'])for(const theme of ['dark','light']){
    await page.goto(base+(variant==='before'?'?baseline=1':'')+'#dashboard');await page.evaluate(()=>document.fonts.ready);await preferences(page,'en',theme);await page.waitForTimeout(400);
    await activate(page.locator('.water-action'));await page.waitForTimeout(300);
    const measurements=await page.evaluate(()=>{
      const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d',{willReadFrequently:true});
      const rgb=css=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=css;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3);};
      const luminance=values=>values.map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
      const root=getComputedStyle(document.documentElement),surfaces=['--surface','--bg','--tint'].map(key=>luminance(rgb(root.getPropertyValue(key))));
      return [...document.querySelectorAll('.dose-time,.dose-action,.dose-status,.habit-undo:not(:disabled),.panel-note,.reading-date')].map(node=>{const style=getComputedStyle(node),foreground=luminance(rgb(style.color)),rect=node.getBoundingClientRect();return {selector:node.className,text:node.textContent,font:parseFloat(style.fontSize),height:rect.height,color:style.color,minContrastToSolidSurfaces:Math.min(...surfaces.map(bg=>(Math.max(bg,foreground)+.05)/(Math.min(bg,foreground)+.05)))};});
    });
    contrast.push({variant,theme,measurements,note:'Conservative computed text contrast against all three solid surface tokens; decorative gradients and disabled controls are not scored as active text.'});
    await writeFile(`${output}/contrast-audit.json`,JSON.stringify(contrast,null,2));
    if(variant==='after')for(const row of measurements)assert(row.minContrastToSolidSurfaces>=4.5,JSON.stringify({variant,theme,row}));
  }
  for(const width of [1440,768,390,320])for(const language of ['ar','en'])for(const theme of ['dark','light']){
    await page.setViewportSize({width,height:width>390?960:844});await page.goto(base+`?high=${width}-${language}-${theme}#dashboard`);await page.evaluate(()=>document.fonts.ready);await preferences(page,language,theme);
    for(const kind of ['pressure','glucose']){
      await activate(page.locator('.dock-add'));await page.locator('dialog select').selectOption(kind);
      if(kind==='pressure'){await page.locator('input[name=systolic]').fill('9999');await page.locator('input[name=diastolic]').fill('9998');}else await page.locator('input[name=glucose]').fill('9999');
      await activate(page.locator('button[type=submit]'));await page.waitForTimeout(650);
      const geometry=await page.evaluate(()=>({overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),readouts:[...document.querySelectorAll('.reading-value,.latest-glucose strong')].map(el=>({text:el.textContent,overflow:Math.max(0,el.scrollWidth-el.clientWidth)})),paths:[...document.querySelectorAll('.chart-line')].filter(el=>Number(getComputedStyle(el).opacity)>0).map(el=>{const b=el.getBBox();return {x:b.x,y:b.y,right:b.x+b.width,bottom:b.y+b.height};}),rows:document.querySelectorAll('.reading-table tbody tr').length}));
      assert.equal(geometry.overflow,0);assert(geometry.readouts.every(row=>row.overflow<=1),JSON.stringify({width,language,theme,kind,geometry}));assert(geometry.paths.every(box=>box.x>=0&&box.y>=0&&box.right<=1000&&box.bottom<=260));assert.equal(geometry.rows,7);
      high.push({width,language,theme,kind,...geometry});
    }
    console.log('HIGH',width,language,theme,'PASS');
  }
  await page.setViewportSize({width:1440,height:960});await activate(page.locator('.brand'));
  assert.equal(await page.locator('.signature-artwork').getAttribute('aria-hidden'),'true');
  assert.equal(await page.locator('.signature-artwork').evaluate(node=>node.getAnimations({subtree:true}).length),0);
  const box=await page.locator('.health-canvas').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+25);
  await page.waitForFunction(()=>document.querySelector('.canvas-light').style.getPropertyValue('--light-x')!=='');
  assert.equal(await page.locator('.health-canvas').evaluate(node=>node.style.getPropertyValue('--light-x')),'');
  await page.mouse.move(0,0);await page.waitForFunction(()=>document.querySelector('.canvas-light').style.getPropertyValue('--light-x')==='');
  for(const language of ['ar','en']){
    await page.setViewportSize({width:320,height:740});await preferences(page,language,'light');
    const help=page.locator('.habits-panel .context-help');await help.locator('summary').scrollIntoViewIfNeeded();await help.locator('summary').press('Enter');
    assert.equal(await help.getAttribute('open'),'');
    await page.waitForFunction(()=>{const r=document.querySelector('.habits-panel .help-bubble').getBoundingClientRect();return r.x>=0&&r.right<=innerWidth;});
    const bubble=await help.locator('.help-bubble').boundingBox();assert(bubble.x>=0&&bubble.x+bubble.width<=320);
    await page.screenshot({path:`${output}/after/goal-help-${language}-320.png`});
    await help.locator('summary').press('Escape');assert.equal(await help.getAttribute('open'),null);
  }
  // Real browser rendering of the 200%-zoom reflow equivalent: 1440/2 CSS px,
  // DPR 2. Not a claim that a native Edge toolbar zoom control was exercised.
  await context.close();
  const zoomContext=await browser.newContext({viewport:{width:720,height:480},deviceScaleFactor:2}),zoomPage=await zoomContext.newPage();watch(zoomPage);
  for(const language of ['ar','en'])for(const theme of ['dark','light'])for(const route of ['home','dashboard']){
    await zoomPage.goto(base+'#'+route);await zoomPage.evaluate(()=>document.fonts.ready);await preferences(zoomPage,language,theme);await zoomPage.waitForTimeout(700);
    const state=await zoomPage.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),mainTransform:getComputedStyle(document.querySelector('main')).transform}));assert.equal(state.overflow,0);assert.equal(state.mainTransform,'none');
    await zoomPage.screenshot({path:`${output}/after/zoom-reflow-200-${language}-${theme}-${route}.png`});zoom.push({language,theme,route,...state});
  }
  await zoomContext.close();await writeFile(`${output}/ux-verification.json`,JSON.stringify({contrast,high,zoom,lightIsolation:'PASS',staticArtwork:'PASS',goalDisclosureKeyboardAndBounds:'PASS',errors},null,2));assert.equal(errors.length,0,JSON.stringify(errors));console.log('PASS: contrast, 32 high-value cases, 8 zoom-reflow cases, isolated light, static artwork, goal disclosure keyboard, no console errors.');
}finally{await browser.close();}
