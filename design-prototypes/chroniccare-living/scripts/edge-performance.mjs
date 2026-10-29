// Reuses the already-installed Playwright and Edge. Production only; no app test flags.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {clsMaximum,comparableSampleDuration,percentile,round} from './motion-statistics.mjs';
import {runInteractions} from './living31-browser.mjs';
import {storyChecks} from './living32-browser.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const runDirectory=process.argv.includes('--control-check')?'edge-control-repeat':process.argv.includes('--mobile-repeat')?'edge-comparison-mobile':process.argv.includes('--compare')?'edge-comparison':process.argv.includes('--probe-light')?'edge-probe':process.argv.includes('--after')?'edge-after':'edge';
const output=fileURLToPath(new URL(`../artifacts/living-3.2.1/${runDirectory}/`,import.meta.url));
const base='http://127.0.0.1:5206/';
const scenarios=['idle','scroll','canvas-pulse','routes','dashboard'];
const activate=async locator=>{await locator.focus();await locator.press('Enter');};
const browser=await chromium.launch({channel:'msedge',headless:true});
await mkdir(output,{recursive:true});
const browserCdp=await browser.newBrowserCDPSession();
const systemInfo=await browserCdp.send('SystemInfo.getInfo');
await writeFile(`${output}/browser-gpu.json`,JSON.stringify({browser:await browser.version(),gpu:systemInfo.gpu},null,2));await browserCdp.detach();
const errors=[];
let documentSequence=0;
async function contextFor(width,language='ar',theme='dark',reducedMotion='no-preference'){
  const context=await browser.newContext({viewport:{width,height:width===1440?960:844},deviceScaleFactor:1,reducedMotion});
  await context.addInitScript(({language,theme})=>{
    localStorage.setItem('cc-living-language',language);localStorage.setItem('cc-living-theme',theme);localStorage.setItem('cc-living-motion','running');
  },{language,theme});
  const page=await context.newPage();
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error'||message.type()==='warning')errors.push({text:message.text(),location:message.location(),page:page.url()});});
  return {context,page};
}
async function prepare(page,scenario,mode,control=false,variant='current'){
  // A unique query forces a real document reload; navigating to the same hash URL does not.
  await page.goto(base+(control?'?motion-control=1':'?motion-audit=1')+`&sample=${++documentSequence}`+(variant==='baseline'?'&baseline=1':'')+(control?'':scenario==='dashboard'?'#dashboard':'#home'));
  await page.locator('#motion-audit-label').waitFor();
  if(!control&&mode==='paused')await activate(page.locator('.motion-toggle'));
  await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1200);
}
async function workload(page,scenario,width){
  if(scenario==='idle')return;
  if(scenario==='scroll'){
    for(let i=0;i<6;i++){await page.keyboard.press('PageDown');await page.waitForTimeout(180);}
  }else if(scenario==='canvas-pulse'){
    // Real pointer movement exercises the chart and interaction light, not just tabs.
    const plot=await page.locator('.chart-plot').boundingBox();assert(plot);
    for(const index of [1,0,1,0]){
      await activate(page.locator('.measurement-switch button').nth(index));
      await page.mouse.move(plot.x+plot.width*.1,plot.y+plot.height*.5);
      await page.mouse.move(plot.x+plot.width*.9,plot.y+plot.height*.5,{steps:20});
      await page.waitForTimeout(300);
    }
    await page.mouse.move(0,0);
    const point=width===390?page.locator('.chart-range input'):page.locator('.chart-point[aria-pressed=true]');
    await point.press('Home');await point.press('End');
    assert.equal(await page.locator('.health-canvas').getAttribute('data-kind'),'pressure');
  }else if(scenario==='routes'){
    for(let i=0;i<2;i++){
      await activate(page.locator('.enter-space'));await page.locator('.workspace-dock').waitFor();
      await activate(page.locator('.brand'));await page.locator('.immersive-intro').waitFor();
    }
  }else if(scenario==='dashboard'){
    await activate(page.locator('.water-action'));await activate(page.locator('.habit-undo').first());
    await activate(page.locator('.steps-action'));await activate(page.locator('.habit-undo').last());
    await activate(page.locator('.dose-action').first());await activate(page.locator('.dose-action').first());
    await activate(page.locator('.workspace-dock button').nth(2));
    await page.locator('dialog select').selectOption('3');assert.equal(await page.locator('dialog .ledger-row').count(),3);
    await page.locator('dialog select').selectOption('7');assert.equal(await page.locator('dialog .ledger-row').count(),7);
    await page.locator('dialog').press('Escape');
    assert.equal(await page.locator('.habit-ring').first().getAttribute('aria-valuenow'),'6');
    assert.equal(await page.locator('.habit-ring').last().getAttribute('aria-valuenow'),'4500');
  }
}
async function cpuMetrics(cdp){const {metrics}=await cdp.send('Performance.getMetrics');return Object.fromEntries(metrics.map(({name,value})=>[name,value]));}
function cpuDelta(before,after){
  const duration=['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration'];
  return Object.fromEntries([...duration.map(name=>[name+'Ms',round((after[name]-before[name])*1000)]),...['LayoutCount','RecalcStyleCount'].map(name=>[name,after[name]-before[name]])]);
}
async function sample(page,cdp,{width,scenario,mode,trial,warmup=false,control=false,variant=process.argv.includes('--probe-light')?'baseline':'current'}){
  const label=[control?'control':warmup?'warmup':'trial',width,scenario,mode,trial,...(process.argv.includes('--compare')?[variant]:[])].join('-');
  await prepare(page,scenario,mode,control,variant);await page.locator('#motion-audit-label').fill(label);
  if(process.argv.includes('--probe-light')&&!control)await page.evaluate(()=>{
    // Diagnostic isolation only: keep the exact handler, geometry, values and effect.
    // Redirect its two inherited custom-property writes to their sole consumer.
    const node=document.querySelector('.health-canvas'),light=node.querySelector('.canvas-light');
    const set=node.style.setProperty.bind(node.style),remove=node.style.removeProperty.bind(node.style);
    node.style.setProperty=(name,value,priority)=>['--light-x','--light-y'].includes(name)?light.style.setProperty(name,value,priority):set(name,value,priority);
    node.style.removeProperty=name=>['--light-x','--light-y'].includes(name)?light.style.removeProperty(name):remove(name);
  });
  const before=await cpuMetrics(cdp);
  await page.locator('#motion-audit button').evaluate(node=>node.click());const started=Date.now();
  await workload(page,scenario,width);
  await page.waitForTimeout(Math.max(0,4000-(Date.now()-started)));
  await page.locator('#motion-audit button').evaluate(node=>node.click());
  const after=await cpuMetrics(cdp);
  await page.locator('#motion-audit-result[data-status=complete]').waitFor();
  const result=JSON.parse(await page.locator('#motion-audit-result').innerText());
  assert.equal(result.label,label);assert.equal(result.visibility,'visible');assert.equal(result.visibilityChanges.length,0);assert(result.frames>0);
  assert.equal(result.viewport[0],width);
  if(!control){assert.equal(result.after.overflow,0);assert.equal(result.before.motion,mode);assert.equal(result.after.motion,mode);assert.equal(result.before.readings,7);assert.equal(result.after.readings,7);assert.equal(result.after.mainTransform,'none');}
  Object.assign(result,{width,scenario,mode,trial,warmup,control,variant,status:comparableSampleDuration(result.sampleMs)?'PASS':'NON_COMPARABLE_WINDOW',cpu:cpuDelta(before,after),method:'Headless installed Edge; fresh settled production reload; 1200ms settle; >=4000ms window; keyboard actions plus 80 pointer steps for canvas; diagnostic controls excluded from event timing; CDP CPU delta brackets the sample'});
  await writeFile(`${output}/${label}.json`,JSON.stringify(result,null,2));
  // Preserve an interrupted/overlong run, but never silently treat it as a 4s trial.
  assert(comparableSampleDuration(result.sampleMs),`Non-comparable sample window: ${result.sampleMs}ms; raw evidence preserved at ${label}.json`);
  console.log(`${label}: median=${result.frameMedianMs} p95=${result.frameP95Ms} gaps=${result.frameGapsOver50ms} cpu=${result.cpu.TaskDurationMs}ms cls=${result.clsMaxSession}`);
  return result;
}
async function benchmark(){
  const results=[];
  for(const width of process.argv.includes('--probe-light')?[1440]:[1440,390]){
    const {context,page}=await contextFor(width),cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
    const system=await page.evaluate(()=>({userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency}));
    await writeFile(`${output}/environment-${width}.json`,JSON.stringify({browser:await browser.version(),...system,viewport:{width,height:width===1440?960:844},headless:true,deviceScaleFactor:1,cpuThrottle:1,networkThrottle:'none',pairOrder:'odd on/off; even off/on',reload:'new document each sample; same browser context; no-store production server; local fonts; warmup excluded',durationMs:4000},null,2));
    for(let trial=1;trial<=5;trial++)results.push(await sample(page,cdp,{width,scenario:'idle',mode:'plain',trial,control:true}));
    for(const scenario of process.argv.includes('--canvas-only')||process.argv.includes('--probe-light')?['canvas-pulse']:scenarios){
      for(const mode of ['running','paused'])await sample(page,cdp,{width,scenario,mode,trial:0,warmup:true});
      for(let trial=1;trial<=5;trial++)for(const mode of trial%2?['running','paused']:['paused','running'])results.push(await sample(page,cdp,{width,scenario,mode,trial}));
    }
    await context.close();
  }
  const summary=[];
  for(const width of [1440,390])for(const scenario of ['idle','scroll','canvas-pulse','routes','dashboard'])for(const mode of ['running','paused']){
    const group=results.filter(row=>!row.control&&row.width===width&&row.scenario===scenario&&row.mode===mode);
    if(group.length)summary.push({width,scenario,mode,repetitions:group.length,medianFrameMs:round(percentile(group.map(row=>row.frameMedianMs),.5)),medianP95Ms:round(percentile(group.map(row=>row.frameP95Ms),.5)),medianLongFrames:percentile(group.map(row=>row.frameGapsOver50ms),.5),medianLongFramesPerSecond:round(percentile(group.map(row=>row.longFramesPerSecond),.5)),maxCLS:Math.max(...group.map(row=>row.clsMaxSession)),medianCpuMs:round(percentile(group.map(row=>row.cpu.TaskDurationMs),.5)),medianScriptMs:round(percentile(group.map(row=>row.cpu.ScriptDurationMs),.5)),medianLayoutMs:round(percentile(group.map(row=>row.cpu.LayoutDurationMs),.5)),medianStyleMs:round(percentile(group.map(row=>row.cpu.RecalcStyleDurationMs),.5)),medianForcedLayoutMs:round(percentile(group.map(row=>row.forcedStyleAndLayoutMs),.5)),medianEventP95Ms:percentile(group.map(row=>row.eventP95Ms).filter(value=>value!==null),.5)});
  }
  await writeFile(`${output}/summary.json`,JSON.stringify({summary,controls:results.filter(row=>row.control).map(({width,frameMedianMs,frameP95Ms,frameGapsOver50ms,cpu})=>({width,frameMedianMs,frameP95Ms,frameGapsOver50ms,cpu})),errors},null,2));
  assert.equal(errors.length,0,JSON.stringify(errors));
}
async function trace(){
  for(const scenario of ['scroll','canvas-pulse','dashboard'])for(const mode of ['running','paused']){
    const {context,page}=await contextFor(1440),cdp=await context.newCDPSession(page);await prepare(page,scenario,mode);
    await cdp.send('Tracing.start',{categories:'devtools.timeline,blink.user_timing,v8,cc,loading,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,disabled-by-default-devtools.timeline.invalidationTracking',transferMode:'ReturnAsStream'});
    const start=Date.now();await workload(page,scenario,1440);await page.waitForTimeout(Math.max(0,4000-(Date.now()-start)));
    const completion=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));await cdp.send('Tracing.end');const {stream}=await completion;
    let contents='';while(true){const part=await cdp.send('IO.read',{handle:stream});contents+=part.base64Encoded?Buffer.from(part.data,'base64').toString():part.data;if(part.eof)break;}await cdp.send('IO.close',{handle:stream});
    await writeFile(`${output}/trace-${scenario}-${mode}.json`,contents);
    const {traceEvents}=JSON.parse(contents),totals={};
    const main=traceEvents.find(event=>event.name==='thread_name'&&event.args.name==='CrRendererMain');
    for(const name of ['RunTask','FunctionCall','Layout','UpdateLayoutTree','Paint','RasterTask','CompositeLayers','FireAnimationFrame','EventDispatch']){
      const events=traceEvents.filter(event=>event.name===name&&event.ph==='X'&&typeof event.dur==='number'&&(name==='RasterTask'||event.pid===main.pid&&event.tid===main.tid));
      totals[name]={count:events.length,totalMs:round(events.reduce((sum,event)=>sum+event.dur,0)/1000),maxMs:round(Math.max(0,...events.map(event=>event.dur))/1000)};
    }
    await writeFile(`${output}/trace-summary-${scenario}-${mode}.json`,JSON.stringify({scenario,mode,windowMs:Date.now()-start,totals,mainThread:{pid:main.pid,tid:main.tid},styleElementVisits:traceEvents.filter(event=>event.name==='UpdateLayoutTree'&&event.pid===main.pid&&event.tid===main.tid).reduce((sum,event)=>sum+(event.args.elementCount??0),0),note:'Separate diagnostic run; tracing overhead excluded from benchmark. Renderer main-thread events only except RasterTask. Nested event totals overlap and MUST NOT be summed as CPU. Raster events run on multiple threads; not a GPU utilization metric.'},null,2));
    console.log('TRACE',scenario,mode,JSON.stringify(totals));await context.close();
  }
}
async function compare(){
  const results=[];
  for(const width of process.argv.includes('--mobile-repeat')?[390]:[1440,390]){
    const {context,page}=await contextFor(width),cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
    for(const variant of ['baseline','current'])await sample(page,cdp,{width,scenario:'canvas-pulse',mode:'running',trial:0,warmup:true,variant});
    for(let trial=1;trial<=5;trial++)for(const variant of trial%2?['baseline','current']:['current','baseline'])results.push(await sample(page,cdp,{width,scenario:'canvas-pulse',mode:'running',trial,variant}));
    await context.close();
  }
  const summary=[];
  for(const width of [1440,390])for(const variant of ['baseline','current']){
    const group=results.filter(row=>row.width===width&&row.variant===variant);
    summary.push({width,variant,repetitions:group.length,medianFrameMs:round(percentile(group.map(row=>row.frameMedianMs),.5)),medianP95Ms:round(percentile(group.map(row=>row.frameP95Ms),.5)),p95RangeMs:[Math.min(...group.map(row=>row.frameP95Ms)),Math.max(...group.map(row=>row.frameP95Ms))],totalGapsOver50ms:group.reduce((sum,row)=>sum+row.frameGapsOver50ms,0),medianCpuMs:round(percentile(group.map(row=>row.cpu.TaskDurationMs),.5)),medianStyleMs:round(percentile(group.map(row=>row.cpu.RecalcStyleDurationMs),.5)),maxCLS:Math.max(...group.map(row=>row.clsMaxSession))});
  }
  await writeFile(`${output}/comparison.json`,JSON.stringify({results,summary,errors},null,2));assert.equal(errors.length,0,JSON.stringify(errors));
}
async function geometry(page){return page.evaluate(()=>({width:innerWidth,language:document.documentElement.lang,direction:document.documentElement.dir,theme:document.documentElement.dataset.theme,overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),cairo:document.fonts.check('16px Cairo'),containers:[...document.querySelectorAll('.topbar,.health-canvas,.canvas-readout,.daily-orbit,.workspace-dock')].filter(el=>el.getBoundingClientRect().width>0).map(el=>({name:el.className,overflow:Math.max(0,el.scrollWidth-el.clientWidth)})),motion:document.querySelector('.living-app').dataset.motion}));}
async function assertLightIsolation(page){
  await page.locator('.health-canvas').scrollIntoViewIfNeeded();
  const box=await page.locator('.health-canvas').boundingBox();
  await page.mouse.move(box.x+box.width*.5,Math.max(170,box.y+25));
  await page.waitForFunction(()=>document.querySelector('.canvas-light').style.getPropertyValue('--light-x')!=='');
  const isolated=await page.locator('.health-canvas').evaluate(node=>({parent:node.style.getPropertyValue('--light-x'),x:node.querySelector('.canvas-light').style.getPropertyValue('--light-x'),y:node.querySelector('.canvas-light').style.getPropertyValue('--light-y')}));
  assert.equal(isolated.parent,'');assert(parseFloat(isolated.x)>=0&&parseFloat(isolated.x)<=100);assert(parseFloat(isolated.y)>=0&&parseFloat(isolated.y)<=100);
  await page.mouse.move(0,0);await page.waitForFunction(()=>document.querySelector('.canvas-light').style.getPropertyValue('--light-x')==='');
}
async function verify(){
  const cases=[];
  for(const width of [1440,390])for(const language of ['ar','en'])for(const theme of ['dark','light']){
    const {context,page}=await contextFor(width,language,theme);
    await context.addInitScript(()=>{
      window.__livingVitals={lcp:[],shifts:[]};
      for(const type of ['largest-contentful-paint','layout-shift'])if(PerformanceObserver.supportedEntryTypes.includes(type)){
        new PerformanceObserver(list=>{for(const entry of list.getEntries()){
          if(type==='layout-shift')window.__livingVitals.shifts.push({startTime:entry.startTime,value:entry.value,hadRecentInput:entry.hadRecentInput});
          else window.__livingVitals.lcp.push({startTime:entry.startTime,size:entry.size});
        }}).observe({type,buffered:true});
      }
    });
    await page.goto(base+'#home');await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1000);
    const home=await geometry(page);assert.equal(home.overflow,0);assert.equal(home.direction,language==='ar'?'rtl':'ltr');assert(home.cairo);assert(home.containers.every(row=>row.overflow<=1));
    const load=await page.evaluate(()=>({vitals:window.__livingVitals,paint:performance.getEntriesByType('paint').map(({name,startTime})=>({name,startTime})),navigation:performance.getEntriesByType('navigation').map(({domContentLoadedEventEnd,loadEventEnd,duration})=>({domContentLoadedEventEnd,loadEventEnd,duration}))}));
    load.clsMaxSession=clsMaximum(load.vitals.shifts);
    await page.screenshot({path:`${output}/${width}-${language}-${theme}-home.png`});
    await activate(page.locator('.enter-space'));await page.locator('.workspace-dock').waitFor();await page.waitForTimeout(700);
    const dashboard=await geometry(page);assert.equal(dashboard.overflow,0);assert(dashboard.containers.every(row=>row.overflow<=1));
    await page.screenshot({path:`${output}/${width}-${language}-${theme}-dashboard.png`});
    await assertLightIsolation(page);
    await workload(page,'dashboard',width);
    const route=page.url();for(let i=0;i<4;i++)await activate(page.locator('.language-toggle'));assert.equal(page.url(),route);assert.equal(await page.locator('.reading-table tbody tr').count(),7);
    await activate(page.locator('.motion-toggle'));assert.equal(await page.locator('.living-app').getAttribute('data-motion'),'paused');
    const paused=await page.evaluate(()=>({animations:[...document.querySelectorAll('.aurora,.pulse-transfer,.value-arrival')].map(el=>getComputedStyle(el).animationName),transition:getComputedStyle(document.querySelector('.main-line')).transitionDuration}));assert(paused.animations.every(name=>name==='none'));assert.equal(paused.transition,'0s');
    await activate(page.locator('.dock-add'));await page.locator('input[name=systolic]').fill('126');await page.locator('input[name=diastolic]').fill('82');await activate(page.locator('button[type=submit]'));assert((await page.locator('.selected-reading').innerText()).includes('126 / 82'));
    await activate(page.locator('.workspace-dock button').nth(2));await page.locator('dialog select').selectOption('3');assert.equal(await page.locator('dialog .ledger-row').count(),3);assert((await page.locator('dialog').innerText()).includes('126'));await page.locator('dialog').press('Escape');
    await activate(page.locator('.motion-toggle'));assert.equal(await page.locator('.living-app').getAttribute('data-motion'),'running');
    await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('.motion-toggle').disabled);assert.equal(await page.locator('.motion-toggle').isDisabled(),true);assert.equal(await page.locator('.living-app').getAttribute('data-motion'),'paused');
    await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>!document.querySelector('.motion-toggle').disabled);assert.equal(await page.locator('.motion-toggle').isDisabled(),false);assert.equal(await page.locator('.living-app').getAttribute('data-motion'),'running');
    cases.push({width,language,theme,status:'PASS',home,dashboard,paused,load,checks:['two routes','7 demo rows','isolated pointer custom properties, bounds and leave cleanup','habits undo','dose toggle','3/7-day reports','four language switches preserve route/data','manual motion off/on','measurement save and report sync while paused','OS reduced-motion live change']});
    await context.close();console.log('VERIFY',width,language,theme,'PASS');
  }
  // Reuse the existing Living regression suites through a thin API adapter.
  // This context has NO preference injection: reload persistence is tested for real.
  const context=await browser.newContext({viewport:{width:1440,height:960}}),page=await context.newPage();
  page.on('pageerror',error=>errors.push(String(error)));page.on('console',message=>{if(['error','warning'].includes(message.type()))errors.push(message.text());});
  await page.goto(base);
  const tab={playwright:page,url:()=>page.url(),reload:()=>page.reload(),pressKey:(_target,key)=>page.keyboard.press(key),screenshot:options=>page.screenshot(options),dev:{logs:async()=>errors}};
  const viewport={set:size=>page.setViewportSize(size)};
  const interactions=await runInteractions({tab,viewport,output}),story=await storyChecks({tab,viewport,output});await context.close();
  await writeFile(`${output}/verification.json`,JSON.stringify({cases,interactions,story,errors},null,2));assert.equal(errors.length,0,JSON.stringify(errors));
}
async function resourceCheck(){
  const {context,page}=await contextFor(1440),resources=[];
  page.on('response',response=>{if(response.status()>=400)resources.push({url:response.url(),status:response.status()});});
  await page.goto(base+'?motion-control=1');await page.waitForTimeout(1000);
  await page.goto(base);await page.waitForTimeout(1000);
  await writeFile(`${output}/resource-check.json`,JSON.stringify({resources,errors},null,2));console.log(JSON.stringify({resources,errors}));await context.close();
}
async function controlCheck(){
  const {context,page}=await contextFor(390),cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
  const results=[];
  for(let trial=1;trial<=5;trial++){
    results.push(await sample(page,cdp,{width:390,scenario:'idle',mode:'plain',trial,control:true}));
    results.push(await sample(page,cdp,{width:390,scenario:'idle',mode:'running',trial}));
    results.push(await sample(page,cdp,{width:390,scenario:'idle',mode:'paused',trial}));
  }
  await writeFile(`${output}/control-check.json`,JSON.stringify({results,errors},null,2));assert.equal(errors.length,0,JSON.stringify(errors));await context.close();
}
try{
  if(process.argv.includes('--control-check'))await controlCheck();else if(process.argv.includes('--resources'))await resourceCheck();else if(process.argv.includes('--compare'))await compare();else if(process.argv.includes('--traces'))await trace();else if(process.argv.includes('--verify'))await verify();else await benchmark();
}finally{await browser.close();}
