// Run in CUA with an existing tab + viewport. No direct browser/CDP driver or extra dependency.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const base='http://127.0.0.1:5206/?motion-audit=1';
const activate=locator=>locator.press('Enter');
export const scenarios=['idle','scroll','canvas-pulse','routes','dashboard'];
async function prepare(tab,mode,scenario){
  const url=base+(scenario==='dashboard'?'#dashboard':'#home');
  if(await tab.url()===url)await tab.reload();else await tab.goto(url);
  await tab.playwright.locator('#motion-audit-label').waitFor({state:'visible'});
  const state=await tab.playwright.evaluate(()=>({lang:document.documentElement.lang,theme:document.documentElement.dataset.theme,motion:document.querySelector('.living-app').dataset.motion}));
  if(state.lang!=='ar')await activate(tab.playwright.locator('.language-toggle'));
  if(state.theme!=='dark')await activate(tab.playwright.locator('.theme-toggle'));
  if(state.motion!==mode)await activate(tab.playwright.locator('.motion-toggle'));
  await tab.playwright.waitForTimeout(1200);
  assert.equal(await tab.playwright.locator('.living-app').getAttribute('data-motion'),mode);
  assert.equal(await tab.playwright.evaluate(()=>document.fonts.status),'loaded');
}
async function workload(tab,scenario,width){
  if(scenario==='idle')return;
  if(scenario==='scroll'){
    for(let i=0;i<6;i++){await tab.pressKey(null,'PageDown');await tab.playwright.waitForTimeout(180);}
  } else if(scenario==='canvas-pulse'){
    for(const index of [1,0,1,0]){await activate(tab.playwright.locator('.measurement-switch button').nth(index));await tab.playwright.waitForTimeout(600);}
    if(width===390){await tab.playwright.locator('.chart-range input').press('Home');await tab.playwright.locator('.chart-range input').press('End');}
    else {await tab.playwright.locator('.chart-point[aria-pressed=true]').press('Home');await tab.playwright.locator('.chart-point[aria-pressed=true]').press('End');}
    assert.equal(await tab.playwright.locator('.health-canvas').getAttribute('data-kind'),'pressure');
  } else if(scenario==='routes'){
    for(let i=0;i<2;i++){
      await activate(tab.playwright.locator('.enter-space'));await tab.playwright.locator('.workspace-dock').waitFor({state:'visible'});
      await activate(tab.playwright.locator('.brand'));await tab.playwright.locator('.immersive-intro').waitFor({state:'visible'});
    }
  } else if(scenario==='dashboard'){
    await activate(tab.playwright.locator('.water-action'));await activate(tab.playwright.locator('.habit-undo').first());
    await activate(tab.playwright.locator('.steps-action'));await activate(tab.playwright.locator('.habit-undo').last());
    await activate(tab.playwright.locator('.dose-action').first());await activate(tab.playwright.locator('.dose-action').first());
    await activate(tab.playwright.locator('.workspace-dock button').nth(2));
    await tab.playwright.locator('dialog select').selectOption('3');assert.equal(await tab.playwright.locator('dialog .ledger-row').count(),3);
    await tab.playwright.locator('dialog select').selectOption('7');assert.equal(await tab.playwright.locator('dialog .ledger-row').count(),7);
    await tab.playwright.locator('dialog').press('Escape');
    assert.equal(await tab.playwright.locator('.habit-ring').first().getAttribute('aria-valuenow'),'6');
    assert.equal(await tab.playwright.locator('.habit-ring').last().getAttribute('aria-valuenow'),'4500');
  } else throw Error('Unknown scenario: '+scenario);
}
export async function runTrials({tab,viewport,output,width,scenario,trials=[1],warmup=false}){
  assert(scenarios.includes(scenario));await mkdir(output,{recursive:true});
  await viewport.set({width,height:width===1440?960:844});
  const results=[];
  for(const trial of trials){
    // Alternate paired order to reduce simple time/order bias. Every trial reloads fresh demo state.
    for(const mode of trial%2?['running','paused']:['paused','running']){
      const label=[warmup?'warmup':'trial',width,scenario,mode,trial].join('-');
      try {
        await prepare(tab,mode,scenario);await tab.playwright.locator('#motion-audit-label').fill(label);
        await activate(tab.playwright.locator('#motion-audit button'));const started=Date.now();
        await workload(tab,scenario,width);
        const remaining=4000-(Date.now()-started);if(remaining>0)await tab.playwright.waitForTimeout(remaining);
        await activate(tab.playwright.locator('#motion-audit button'));
        await tab.playwright.locator('#motion-audit-result[data-status=complete]').waitFor({state:'visible'});
        const result=JSON.parse(await tab.playwright.locator('#motion-audit-result').innerText());
        assert.equal(result.label,label);assert.equal(result.before.motion,mode);assert.equal(result.after.motion,mode);
        assert.equal(result.viewport[0],width);assert.equal(result.before.readings,7);assert.equal(result.after.readings,7);
        assert.equal(result.visibility,'visible');assert.equal(result.visibilityChanges.length,0);
        assert.equal(result.after.overflow,0);assert.equal(result.after.mainTransform,'none');assert(result.frames>0);
        Object.assign(result,{scenario,width,mode,trial,warmup,status:'PASS',method:'CUA keyboard; 1200ms settled reload; >=4000ms explicit sample; same fixed workload'});
        await writeFile(output+'/'+label+'.json',JSON.stringify(result,null,2));
        results.push({label,median:result.frameMedianMs,p95:result.frameP95Ms,longFrames:result.frameGapsOver50ms,loafs:result.loafCount,forced:result.forcedStyleAndLayoutMs,mutations:result.domMutationRecords});
      } catch(error){
        await writeFile(output+'/'+label+'-failure.json',JSON.stringify({label,status:'FAIL',error:String(error)},null,2));throw error;
      }
    }
  }
  return results;
}
