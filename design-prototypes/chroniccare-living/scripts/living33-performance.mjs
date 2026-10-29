// Paired Production-only 3.2.1/3.3 benchmark. No app code or historical evidence is changed.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {comparableSampleDuration,percentile,round} from './motion-statistics.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const output=fileURLToPath(new URL(`../artifacts/living-3.3/${process.argv.includes('--final')?'performance-final':'performance'}/`,import.meta.url));await mkdir(output,{recursive:true});
const resumeMobile=process.argv.includes('--resume-mobile');
const browser=await chromium.launch({channel:'msedge',headless:true}),errors=[];
const browserCdp=await browser.newBrowserCDPSession(),system=await browserCdp.send('SystemInfo.getInfo');
await writeFile(`${output}/environment${resumeMobile?'-mobile-resume':''}.json`,JSON.stringify({browser:await browser.version(),headless:true,gpu:system.gpu,deviceScaleFactor:1,networkThrottle:'none',cpuThrottle:1,backgroundLoad:'Not isolated',method:'Same context and alternating variant order, >=4s samples, 1200ms settled reload, local production assets, 5 repetitions. Mobile uses real touchscreen taps on centered range with hasTouch=true; tab activation uses keyboard in both variants. rAF is not a guarantee of physically presented frames.'},null,2));await browserCdp.detach();
const activate=async locator=>{await locator.focus();await locator.press('Enter');};
let sequence=0;
async function cpu(cdp){return Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(({name,value})=>[name,value]));}
try{
  for(const width of resumeMobile?[390]:[1440,390]){
    const context=await browser.newContext({viewport:{width,height:width===1440?960:844},deviceScaleFactor:1,hasTouch:width===390,reducedMotion:'no-preference'});
    await context.addInitScript(()=>{localStorage.setItem('cc-living-language','ar');localStorage.setItem('cc-living-theme','dark');localStorage.setItem('cc-living-motion','running');});
    const page=await context.newPage(),cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
    page.on('pageerror',error=>errors.push(String(error)));page.on('console',msg=>{if(['warning','error'].includes(msg.type()))errors.push(msg.text());});
    async function sample(scenario,variant,trial,warmup=false){
      const control=scenario==='control',label=`${width}-${scenario}-${variant}-${trial}${warmup?'-warmup':''}`;
      await page.goto(`http://127.0.0.1:5206/?${control?'motion-control':'motion-audit'}=1&sample=${++sequence}${variant==='before'?'&baseline=1':''}#home`);
      await page.locator('#motion-audit-label').waitFor();await page.evaluate(()=>document.fonts.ready);
      if(scenario==='canvas')await page.locator('.chart-plot').evaluate(node=>node.scrollIntoView({block:'center',behavior:'instant'}));
      await page.waitForTimeout(1200);await page.locator('#motion-audit-label').fill(label);
      const before=await cpu(cdp);await page.locator('#motion-audit button').evaluate(node=>node.click());const start=Date.now();
      if(scenario==='scroll')for(let i=0;i<6;i++){await page.keyboard.press('PageDown');await page.waitForTimeout(180);}
      if(scenario==='canvas')for(const index of [1,0,1,0]){
        await activate(page.locator('.measurement-switch button').nth(index));
        if(width===1440){const plot=await page.locator('.chart-plot').boundingBox();await page.mouse.move(plot.x+plot.width*.1,plot.y+plot.height*.5);await page.mouse.move(plot.x+plot.width*.9,plot.y+plot.height*.5,{steps:20});}
        else {const slider=page.locator('.chart-range input');await slider.evaluate(node=>node.scrollIntoView({block:'center',behavior:'instant'}));await page.waitForTimeout(50);const range=await slider.boundingBox();await page.touchscreen.tap(range.x+3,range.y+range.height/2);assert.equal(await slider.inputValue(),'0');await page.touchscreen.tap(range.x+range.width-3,range.y+range.height/2);assert.equal(await slider.inputValue(),'6');}
        await page.waitForTimeout(250);
      }
      await page.waitForTimeout(Math.max(0,4000-(Date.now()-start)));await page.locator('#motion-audit button').evaluate(node=>node.click());const after=await cpu(cdp);
      await page.locator('#motion-audit-result[data-status=complete]').waitFor();const result=JSON.parse(await page.locator('#motion-audit-result').innerText());
      Object.assign(result,{width,scenario,variant,trial,warmup,status:comparableSampleDuration(result.sampleMs)?'PASS':'NON_COMPARABLE_WINDOW',cpu:Object.fromEntries(['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration'].map(key=>[key+'Ms',round((after[key]-before[key])*1000)]))});
      await writeFile(`${output}/${label}.json`,JSON.stringify(result,null,2));assert(comparableSampleDuration(result.sampleMs),`Interrupted window preserved: ${label}`);assert.equal(result.visibilityChanges.length,0);assert(result.frames>0);
      if(!control){assert.equal(result.after.overflow,0);assert.equal(result.after.readings,7);assert.equal(result.after.motion,'running');}
      console.log(label,JSON.stringify({median:result.frameMedianMs,p95:result.frameP95Ms,gaps:result.frameGapsOver50ms,cpu:result.cpu.TaskDurationMs,cls:result.clsMaxSession}));
    }
    for(const trial of resumeMobile?[6]:[1,2,3,4,5])await sample('control','plain',trial);
    for(const scenario of resumeMobile?['canvas']:['scroll','canvas']){
      await sample(scenario,'before',0,true);await sample(scenario,'after',0,true);
      for(let trial=1;trial<=5;trial++)for(const variant of trial%2?['before','after']:['after','before'])await sample(scenario,variant,trial);
    }
    await context.close();
  }
  const files=(await readdir(output)).filter(name=>/^(1440|390)-(control|scroll|canvas)-(plain|before|after)-[1-9]\d*\.json$/.test(name));
  const rows=await Promise.all(files.map(async name=>JSON.parse(await readFile(`${output}/${name}`,'utf8'))));
  assert(rows.every(row=>comparableSampleDuration(row.sampleMs)&&row.status==='PASS'),'Every pooled sample must pass temporal validation');
  const summary=[];
  for(const width of [1440,390])for(const scenario of ['control','scroll','canvas'])for(const variant of scenario==='control'?['plain']:['before','after']){
    const group=rows.filter(row=>row.width===width&&row.scenario===scenario&&row.variant===variant);
    assert(scenario==='control'?group.length>=5:group.length===5,`Incomplete group: ${width} ${scenario} ${variant}`);
    summary.push({width,scenario,variant,repetitions:group.length,medianFrameMs:round(percentile(group.map(row=>row.frameMedianMs),.5)),medianP95Ms:round(percentile(group.map(row=>row.frameP95Ms),.5)),p95Range:[Math.min(...group.map(row=>row.frameP95Ms)),Math.max(...group.map(row=>row.frameP95Ms))],totalLongGaps:group.reduce((sum,row)=>sum+row.frameGapsOver50ms,0),medianTaskMs:round(percentile(group.map(row=>row.cpu.TaskDurationMs),.5)),medianStyleMs:round(percentile(group.map(row=>row.cpu.RecalcStyleDurationMs),.5)),maxCLS:Math.max(...group.map(row=>row.clsMaxSession))});
  }
  await writeFile(`${output}/summary.json`,JSON.stringify({summary,errors},null,2));assert.equal(errors.length,0,JSON.stringify(errors));console.log('PERFORMANCE COMPLETE');
}finally{await browser.close();}
