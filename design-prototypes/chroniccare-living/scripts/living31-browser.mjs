// Browser regression suite for the documented Codex browser tab API.
// Run from cua_repl: import this module, then pass the existing tab and viewport handles.
// No direct Playwright/CDP connection, app-side test switch, or extra package is needed.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const sizes=[{width:1440,height:960},{width:768,height:1024},{width:390,height:844},{width:320,height:740}];
async function preferences(tab,language,theme){
  const state=await tab.playwright.evaluate(()=>({lang:document.documentElement.lang,theme:document.documentElement.dataset.theme}));
  if(state.lang!==language)await tab.playwright.locator('.language-toggle').click();
  if(state.theme!==theme)await tab.playwright.locator('.theme-toggle').click();
}
async function geometry(tab){
  return tab.playwright.evaluate(()=>({
    language:document.documentElement.lang,direction:document.documentElement.dir,theme:document.documentElement.dataset.theme,
    width:innerWidth,height:innerHeight,overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),cairo:document.fonts.check('16px Cairo'),
    containers:[...document.querySelectorAll('.topbar,.health-canvas,.canvas-readout,.daily-orbit,.workspace-dock,.report-link')].filter(el=>el.getBoundingClientRect().width>0).map(el=>({name:el.className,overflow:Math.max(0,el.scrollWidth-el.clientWidth)}))
  }));
}
export async function runMatrix({tab,viewport,output,language,widths=sizes.map(size=>size.width),extension='png'}){
  await mkdir(output,{recursive:true});
  const cases=[];
  for(const size of sizes.filter(size=>widths.includes(size.width))){
    await viewport.set(size);
    for(const theme of ['dark','light']){
      await preferences(tab,language,theme);await tab.playwright.locator('.brand').click();await tab.playwright.locator('.immersive-intro').waitFor({state:'visible'});
      await tab.playwright.waitForTimeout(1000); // Finish actual entrance/drawing animations before approval stills.
      const home=await geometry(tab),name=`${language}-${theme}-${size.width}`;
      assert.equal(home.language,language);assert.equal(home.direction,language==='ar'?'rtl':'ltr');assert.equal(home.theme,theme);assert.equal(home.overflow,0);assert(home.cairo);
      assert(home.containers.every(el=>el.overflow<=1),JSON.stringify(home.containers));
      await writeFile(`${output}/${name}-home.${extension}`,await tab.screenshot({fullPage:false}));
      await tab.playwright.locator('.enter-space').click();
      await tab.playwright.locator('.workspace-dock').waitFor({state:'visible'});
      const entering=await tab.playwright.evaluate(()=>{const dock=document.querySelector('.workspace-dock'),r=dock.getBoundingClientRect();return {position:getComputedStyle(dock).position,top:r.top,bottom:r.bottom,height:innerHeight,transform:getComputedStyle(document.querySelector('main')).transform};});
      assert.equal(entering.transform,'none','The route must not establish a transformed containing block');
      if(entering.position==='fixed'){assert(entering.top>=0);assert(entering.bottom<=entering.height+1,'Dock must stay inside the viewport during route entry');}
      await tab.playwright.waitForTimeout(1000);
      const dashboard=await geometry(tab);assert.equal(dashboard.overflow,0);assert(dashboard.containers.every(el=>el.overflow<=1),JSON.stringify(dashboard.containers));
      const route=await tab.url();await tab.playwright.locator('.skip-link').press('Enter');assert.equal(await tab.url(),route,'Skip link must preserve the dashboard route');
      assert.equal(await tab.playwright.evaluate(()=>document.activeElement.id),'main-content');
      // Restore the top for a comparable, settled screenshot via the existing navigation.
      await tab.playwright.locator('.brand').click();await tab.playwright.locator('.immersive-intro').waitFor({state:'visible'});await tab.playwright.locator('.enter-space').click();await tab.playwright.locator('.workspace-dock').waitFor({state:'visible'});await tab.playwright.waitForTimeout(650);
      await writeFile(`${output}/${name}-dashboard.${extension}`,await tab.screenshot({fullPage:false}));
      cases.push({name,home,dashboard,dockDuringEntry:entering,skip:'PASS'});
    }
  }
  await writeFile(`${output}/matrix-${language}-${widths.join('-')}.json`,JSON.stringify(cases,null,2));
  return {status:'PASS',language,layoutCases:cases.length*2,cases};
}

export async function runInteractions({tab,viewport,output,extension='png'}){
  await viewport.set({width:320,height:740});await preferences(tab,'en','light');
  await tab.playwright.locator('.brand').click();await tab.playwright.locator('.immersive-intro').waitFor({state:'visible'});await tab.playwright.locator('.enter-space').click();await tab.playwright.locator('.workspace-dock').waitFor({state:'visible'});await tab.playwright.waitForTimeout(650);
  let reached=false;
  for(let i=0;i<30;i++){
    await tab.pressKey(null,'Tab');await tab.playwright.waitForTimeout(100);
    const readFocus=()=>tab.playwright.evaluate(()=>{const el=document.activeElement,r=el.getBoundingClientRect(),dock=document.querySelector('.workspace-dock').getBoundingClientRect(),header=document.querySelector('.topbar').getBoundingClientRect();return {report:el.classList.contains('report-link'),top:r.top,bottom:r.bottom,safeTop:header.bottom,safeBottom:dock.top};});
    let focus=await readFocus();
    if(focus.report){
      // Wait for the app's rAF focus correction, not a presumed 60Hz test host.
      for(let frame=0;frame<20&&(focus.top<focus.safeTop+10||focus.bottom>focus.safeBottom-10);frame++){await tab.playwright.waitForTimeout(100);focus=await readFocus();}
      assert(focus.top>=focus.safeTop+10);assert(focus.bottom<=focus.safeBottom-10,JSON.stringify(focus));reached=true;break;
    }
  }
  assert(reached,'Reports must remain reachable by natural keyboard navigation');
  await writeFile(`${output}/focus-card-clear-of-dock-320.${extension}`,await tab.screenshot({fullPage:false}));
  await tab.playwright.locator('.menu-toggle').click();await tab.playwright.locator('.menu-toggle').press('Escape');assert.equal(await tab.playwright.locator('.menu-toggle').getAttribute('aria-expanded'),'false');
  await tab.playwright.locator('.menu-toggle').click();await tab.playwright.locator('.route-links button').first().press('Escape');assert.equal(await tab.playwright.locator('.menu-toggle').getAttribute('aria-expanded'),'false');
  assert.equal(await tab.playwright.evaluate(()=>document.activeElement.classList.contains('menu-toggle')),true);
  await tab.playwright.locator('.dock-add').click();
  const dialog=tab.playwright.locator('dialog');
  await dialog.locator('input[name=systolic]').fill('120');await dialog.locator('input[name=diastolic]').fill('130');await dialog.locator('button[type=submit]').click();
  const invalid=await tab.playwright.evaluate(()=>({focus:document.activeElement.getAttribute('name'),description:document.querySelector('input[name=diastolic]').getAttribute('aria-describedby'),systolic:document.querySelector('input[name=systolic]').getAttribute('aria-invalid')}));
  assert.equal(invalid.focus,'diastolic');assert.equal(invalid.description,'reading-error');assert.equal(invalid.systolic,null);
  await writeFile(`${output}/validation-diastolic-focus-light-320.${extension}`,await tab.screenshot({fullPage:false}));
  const fieldColor=await dialog.locator('input[name=systolic]').evaluate(el=>({border:getComputedStyle(el).borderColor,bg:getComputedStyle(el).backgroundColor}));
  const luminance=rgb=>rgb.map(n=>{const x=n/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
  const contrast=(luminance(fieldColor.bg.match(/\d+/g).slice(0,3).map(Number))+.05)/(luminance(fieldColor.border.match(/\d+/g).slice(0,3).map(Number))+.05);
  assert(contrast>=3,`Light input border contrast ${contrast}`);
  await dialog.locator('input[name=systolic]').fill('126');await dialog.locator('input[name=diastolic]').fill('82');await dialog.locator('button[type=submit]').click();
  assert((await tab.playwright.locator('.canvas-readout').innerText()).includes('126 / 82'));
  await tab.playwright.locator('.workspace-dock button').nth(2).click();await dialog.locator('select').selectOption('3');
  assert.equal(await dialog.locator('.ledger-row').count(),3);assert((await dialog.innerText()).includes('126'));
  await dialog.press('Escape');
  await tab.playwright.locator('.water-action').click();assert.equal(await tab.playwright.locator('.habit-ring').first().getAttribute('aria-valuenow'),'7');await tab.playwright.locator('.habit-undo').first().click();assert.equal(await tab.playwright.locator('.habit-ring').first().getAttribute('aria-valuenow'),'6');
  await tab.playwright.locator('.steps-action').click();assert.equal(await tab.playwright.locator('.habit-ring').last().getAttribute('aria-valuenow'),'5000');await tab.playwright.locator('.habit-undo').last().click();assert.equal(await tab.playwright.locator('.habit-ring').last().getAttribute('aria-valuenow'),'4500');
  await tab.playwright.locator('.dose-action').first().click();assert.equal(await tab.playwright.locator('.dose-action').first().getAttribute('aria-pressed'),'true');await tab.playwright.locator('.dose-action').first().click();
  await tab.playwright.locator('.assistant-panel>summary').click();await tab.playwright.locator('.assistant-panel select').selectOption('two');await tab.playwright.locator('.assistant-panel .no-response').waitFor({state:'visible'});assert((await tab.playwright.locator('.assistant-panel').innerText()).includes('No AI response'));
  const route=await tab.url();for(let i=0;i<4;i++)await tab.playwright.locator('.language-toggle').click();assert.equal(await tab.url(),route);assert((await tab.playwright.locator('.canvas-readout').innerText()).includes('126 / 82'));
  await tab.playwright.locator('.motion-toggle').click();
  const paused=await tab.playwright.evaluate(()=>({state:document.querySelector('.living-app').getAttribute('data-motion'),animations:[...document.querySelectorAll('.aurora,.pulse-transfer,.value-arrival')].map(el=>getComputedStyle(el).animationName),transitions:getComputedStyle(document.querySelector('.main-line')).transitionDuration}));
  assert.equal(paused.state,'paused');assert(paused.animations.every(name=>name==='none'));assert.equal(paused.transitions,'0s');
  await tab.playwright.locator('.chart-range input').press('Home');assert((await tab.playwright.locator('.selected-reading').innerText()).includes('122 / 78'));
  await tab.playwright.locator('.chart-range input').press('End');
  await tab.playwright.locator('.motion-toggle').click();
  await viewport.set({width:1440,height:960});await tab.playwright.locator('.measurement-switch button').nth(1).click();
  await tab.playwright.locator('.chart-point[aria-pressed=true]').press('Home');assert((await tab.playwright.locator('.selected-reading').innerText()).includes('102'));
  await tab.playwright.locator('.chart-point[aria-pressed=true]').press('End');assert((await tab.playwright.locator('.selected-reading').innerText()).includes('98'));
  await tab.playwright.locator('.reading-table>summary').click();assert.equal(await tab.playwright.locator('.reading-table tbody tr').count(),7);
  await tab.playwright.locator('.notification-trigger').click();await dialog.locator('.mark-read').click();assert(await dialog.locator('.mark-read').isEnabled()===false);await dialog.press('Escape');
  const logs=await tab.dev.logs({levels:['error','warn'],limit:100});assert.equal(logs.length,0,JSON.stringify(logs));
  const result={status:'PASS',contrast,checks:['natural keyboard focus clear of dock','Escape from trigger and menu child','validation field association/focus','measurement/chart/report sync','3-day and 7-day data','habit and medication update/undo','assistant demo','four language switches preserve route/data','motion pause stops animation and transitions','touch-range and chart keyboard navigation','notifications','no browser warnings/errors'],paused,logs};
  await writeFile(`${output}/interactions.json`,JSON.stringify(result,null,2));return result;
}
