// Uses only the documented CUA tab/viewport APIs supplied by the caller.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

export async function performanceSample({tab,viewport,width,output,label,pointer=false}){
  await mkdir(output,{recursive:true});
  const activate=locator=>pointer?locator.click():locator.press('Enter');
  await viewport.set({width,height:width===1440?960:844});
  await tab.playwright.locator('.brand').press('Enter');await tab.playwright.locator('.immersive-intro').waitFor({state:'visible'});
  await tab.playwright.waitForTimeout(1000);
  await activate(tab.playwright.locator('#motion-audit button'));
  await activate(tab.playwright.locator('.measurement-switch button').nth(1));
  await tab.playwright.waitForTimeout(650);
  await activate(tab.playwright.locator('.measurement-switch button').first());
  await tab.playwright.waitForTimeout(650);
  for(let i=0;i<6;i++){await tab.pressKey(null,'PageDown');await tab.playwright.waitForTimeout(180);}
  const scenes=await tab.playwright.evaluate(()=>[...document.querySelectorAll('.reveal')].map(el=>({name:el.id||el.className,visible:el.classList.contains('in-view'),transform:getComputedStyle(el).transform})));
  await tab.playwright.locator('.brand').press('Enter');await tab.playwright.locator('.immersive-intro').waitFor({state:'visible'});
  await tab.playwright.waitForTimeout(900); // Settle the existing smooth return-to-top before the next pointer click.
  await tab.playwright.locator('.enter-space').press('Enter');await tab.playwright.locator('.workspace-dock').waitFor({state:'visible'});
  await activate(tab.playwright.locator('.water-action'));await activate(tab.playwright.locator('.habit-undo').first());
  await activate(tab.playwright.locator('.dose-action').first());await activate(tab.playwright.locator('.dose-action').first());
  await tab.playwright.waitForTimeout(650);
  await activate(tab.playwright.locator('#motion-audit button'));
  const result=JSON.parse(await tab.playwright.locator('#motion-audit-result').innerText());
  result.scenes=scenes;result.label=label;result.input=pointer?'pointer + keyboard route activation':'keyboard';
  await writeFile(`${output}/${label}-${width}.json`,JSON.stringify(result,null,2));
  return result;
}

export async function storyChecks({tab,viewport,output}){
  await viewport.set({width:1440,height:960});
  await tab.playwright.locator('.brand').click();await tab.playwright.locator('.immersive-intro').waitFor({state:'visible'});
  const initial=await tab.playwright.evaluate(()=>({beats:document.querySelectorAll('.motion-enter').length,pending:document.querySelectorAll('.motion-enter:not(.in-view)').length}));
  assert.equal(initial.beats,14);assert(initial.pending>0);
  await tab.playwright.locator('.motion-toggle').click();
  const paused=await tab.playwright.evaluate(()=>[...document.querySelectorAll('.motion-enter')].map(el=>({opacity:getComputedStyle(el).opacity,transform:getComputedStyle(el).transform})));
  assert(paused.every(el=>el.opacity==='1'&&el.transform==='none'),'Pause shows even unseen story beats');
  const route=await tab.url();
  for(let i=0;i<5;i++){
    await tab.playwright.locator('.experience-index button').nth(i).click();
    assert.equal(await tab.url(),route,'Story navigation never changes the route');
  }
  await tab.playwright.locator('.motion-toggle').click();
  await tab.playwright.locator('.experience-index button').nth(3).click();await tab.playwright.waitForTimeout(1000);
  const ambient=await tab.playwright.evaluate(()=>({state:document.querySelector('.living-app').dataset.ambient,animations:[...document.querySelectorAll('.aurora')].map(el=>getComputedStyle(el).animationPlayState)}));
  assert.equal(ambient.state,'rest');assert(ambient.animations.every(value=>value==='paused'));
  await tab.playwright.locator('.experience-index button').first().click();await tab.playwright.waitForTimeout(1000);
  const seen=await tab.playwright.locator('.week-lens').getAttribute('class');assert(seen.includes('in-view'));
  const bar=await tab.playwright.evaluate(()=>{const node=document.querySelector('.week-bar-track>span');return {transform:node.style.transform,height:getComputedStyle(node).height,origin:getComputedStyle(node).transformOrigin};});
  assert(bar.transform.startsWith('scaleY('),'Bars animate via a transform, not a per-frame layout change');
  await tab.playwright.locator('.routine-item .dose-action').first().press('Tab');
  const focus=await tab.playwright.evaluate(()=>{const beat=document.activeElement.closest('.motion-enter');return beat?{opacity:getComputedStyle(beat).opacity,transform:getComputedStyle(beat).transform}:null;});
  assert(focus&&focus.opacity==='1'&&focus.transform==='none','Keyboard focus reveals its beat immediately');
  await tab.playwright.locator('.brand').click();await tab.playwright.waitForTimeout(300);
  assert((await tab.playwright.locator('.week-lens').getAttribute('class')).includes('in-view'),'Seen content does not reset when scrolling back');
  const beforePersist=await tab.playwright.evaluate(()=>({language:document.documentElement.lang,theme:document.documentElement.dataset.theme}));
  await tab.playwright.locator('.motion-toggle').click();await tab.reload();
  assert.equal(await tab.playwright.locator('.living-app').getAttribute('data-motion'),'paused','Motion preference persists across reload');
  const persist=await tab.playwright.evaluate(()=>({language:document.documentElement.lang,theme:document.documentElement.dataset.theme}));
  assert.equal(persist.language,beforePersist.language);assert.equal(persist.theme,beforePersist.theme);
  await tab.playwright.locator('.enter-space').click();await tab.playwright.locator('.workspace-dock').waitFor({state:'visible'});
  await tab.playwright.locator('.water-action').click();assert.equal(await tab.playwright.locator('.habit-ring').first().getAttribute('aria-valuenow'),'7');
  assert((await tab.playwright.locator('.habit-sentence').first().innerText()).includes('7'),'Essential feedback survives paused motion');
  await tab.playwright.locator('.habit-undo').first().click();await tab.playwright.locator('.motion-toggle').click();
  const result={status:'PASS',initial,ambient,bar,focus,persist,checks:['14 independently revealed beats','all unseen content visible while paused','five story destinations preserve route','ambient rests offscreen','transform-only weekly bars','focused beat immediately visible','one-shot reveal','motion/language/theme persistence','static feedback and undo while paused']};
  await writeFile(`${output}/story-motion.json`,JSON.stringify(result,null,2));return result;
}
