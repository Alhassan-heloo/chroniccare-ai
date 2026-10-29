// Browser verification uses the existing in-memory demo adapter only. No backend.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const root = fileURLToPath(new URL('..', import.meta.url));
const before = process.argv.includes('--before'), production = process.argv.includes('--production'), base = 'http://127.0.0.1:5186';
const artifactRoot = resolve(root, 'artifacts/phase1e-reports'), output = resolve(artifactRoot, before ? 'before' : 'after');
await mkdir(output, { recursive: true });
const report = { mode: production ? 'production preview' : 'Vite development', cases: [], workflows: [], errors: [], backendRequests: [] };
const protectedPaths = ['src/lib', 'src/hooks', 'src/auth', 'src/theme', 'src/app/router.tsx', 'src/i18n', 'src/pages/patient/DashboardPage.tsx', 'src/pages/patient/MeasurementsPage.tsx', 'src/pages/patient/MedicationsPage.tsx', 'src/components/health/MedicationScheduleCard.tsx', 'src/components/health/MedicationForm.tsx', 'src/styles/living-medications.css', 'src/pages/patient/HabitsPage.tsx', 'src/components/health/HabitCard.tsx', 'src/components/health/HabitForm.tsx', 'src/components/health/HabitProgressForm.tsx', 'src/styles/living-habits.css', 'src/components/health/MeasurementFilters.tsx', 'src/components/health/MeasurementListCard.tsx', 'src/components/health/MeasurementForm.tsx', 'src/components/public', 'src/styles/globals.css', 'src/styles/living-public.css', 'src/styles/living-dashboard.css', 'src/styles/living-measurements.css', '../backend/src', '../backend/migrations', '../../design-prototypes/chroniccare-living/src'];
async function hashes() {
  const result = {};
  async function visit(path) {
    if (/^src[\\/]i18n[\\/]locales[\\/](ar|en)\.ts$/.test(relative(root,path))) return;
    const entries = await readdir(path, { withFileTypes: true }).catch(error => { if (error.code === 'ENOTDIR') return null; throw error; });
    if (entries) { for (const entry of entries) await visit(resolve(path, entry.name)); }
    else result[relative(root, path)] = createHash('sha256').update(await readFile(path)).digest('hex');
  }
  for (const path of protectedPaths) await visit(resolve(root, path));
  for (const language of ['ar','en']) {
    const catalog=(await readFile(resolve(root,`src/i18n/locales/${language}.ts`),'utf8')).replaceAll('\r\n','\n').replace(/^\s+(assessmentNotice|chartDescription):.*\n/gm,'');
    result[`locale-${language}#existing-translations`]=createHash('sha256').update(catalog).digest('hex');
  }
  const chart = (await readFile(resolve(root, 'src/components/charts/ReportChart.tsx'), 'utf8')).replaceAll('\r\n', '\n');
  for (const [name, from, to] of [['series', '  const data = points', '  const first = data[0]'], ['range-and-ticks', '  // Pad the measured range', '  return (']]) {
    const start = chart.indexOf(from), end = chart.indexOf(to, start);
    assert(start >= 0 && end > start, `Chart ${name} guard boundaries exist`);
    result[`ReportChart.tsx#${name}`] = createHash('sha256').update(chart.slice(start,end)).digest('hex');
  }
  return result;
}
const fingerprints = await hashes(); report.protectedFiles = Object.keys(fingerprints).length;
if (before) await writeFile(resolve(artifactRoot, 'protected-sources.json'), JSON.stringify(fingerprints, null, 2));
else assert.deepEqual(fingerprints, JSON.parse(await readFile(resolve(artifactRoot, 'protected-sources.json'), 'utf8')), 'Protected sources changed');
async function navigate(page, path) {
  const route = path.split(/[?#]/)[0];
  const rail = page.locator(`.sidebar a[href="${route}"]`);
  const mobile = page.locator(`.bottom-nav a[href="${route}"]`);
  if (await rail.isVisible()) await rail.click();
  else if (await mobile.isVisible()) await mobile.click();
  else {
    await page.locator('.bottom-nav button[aria-expanded]').click();
    await page.locator(`.more-nav a[href="${route}"]`).click();
    await page.locator('dialog[open]').waitFor({ state: 'hidden' });
  }
  await page.waitForURL(`${base}${route}`);
  // Exercise URL preservation with a real browser history entry as well.
  if (path !== route) await page.evaluate(path => { history.pushState(null, '', path); dispatchEvent(new PopStateEvent('popstate')); }, path);
  await page.waitForURL(`${base}${path}`);
  await page.locator(path.startsWith('/patient/reports') ? '.report-summary' : path.startsWith('/patient/habits') ? '.habits-page' : path.startsWith('/patient/medications') ? '.medication-schedule' : path.startsWith('/patient/dashboard') ? '.weekly-section .recharts-surface' : '.measurement-entry').first().waitFor();
}
async function setup(browser, width, language, theme) {
  const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 960 : width === 768 ? 1024 : 844 }, reducedMotion: 'reduce' });
  await context.addInitScript(({ language, theme }) => { localStorage.setItem('cc-language', language); localStorage.setItem('cc-theme', theme); localStorage.setItem('cc-public-motion', 'running'); }, { language, theme });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) report.errors.push(message.text()); });
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) report.backendRequests.push(new URL(request.url()).pathname); });
  await page.goto(`${base}/login`); await page.locator('.auth-card > .btn-secondary').click(); await page.waitForURL('**/patient/dashboard');
  await page.locator('.weekly-section .recharts-surface').waitFor();
  return { context, page };
}
async function capture(page, name, meta) {
  if (!meta.workflow) await page.evaluate(()=>{if(document.activeElement instanceof HTMLElement)document.activeElement.blur();});
  await page.evaluate(() => document.fonts.ready); await page.mouse.move(0, 0); await page.evaluate(() => window.scrollTo(0, 0));
  const geometry = await page.evaluate(() => {
    const visible = node => node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().height > 0 && getComputedStyle(node).visibility !== 'hidden';
    const containers = [...document.querySelectorAll('.reports-page,.report-summary,.report-summary .card,.report-chart-panel,.report-charts,.report-readings li,.report-periods,.report-day-details,.report-single-day,.report-single-values,.field,dialog[open],.dialog-heading,.header-actions,.preferences')].filter(visible).filter(node => node.scrollWidth > node.clientWidth + 1).map(node => node.className);
    const overlaps = [];
    for (const row of document.querySelectorAll('.header-actions,.preferences,.medication-card-actions,.dose-list li,.dialog-heading,.confirmation-actions,.bottom-nav')) {
      const children = [...row.children].filter(visible);
      for (let i = 0; i < children.length; i++) for (let j = i + 1; j < children.length; j++) { const a = children[i].getBoundingClientRect(), b = children[j].getBoundingClientRect(); if (Math.min(a.right,b.right)-Math.max(a.left,b.left)>1 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1) overlaps.push(row.className); }
    }
    const shell = document.querySelector('.living-public');
    const recipe = selector => {
      const node = document.querySelector(selector); if (!node) return null;
      const style = getComputedStyle(node);
      return Object.fromEntries(['backgroundColor','borderRadius','borderTopColor','boxShadow','fontFamily'].map(key => [key, style[key]]));
    };
    const icon = document.querySelector('.dashboard-routine .dashboard-feature-icon,.report-chart-panel .dashboard-feature-icon');
    const unnamedControls = [...document.querySelectorAll('.reports-page button,.reports-page summary')].filter(visible).filter(node => !(node.getAttribute('aria-label') || node.textContent.trim() || (node.labels && [...node.labels].some(label => label.textContent.trim())))).map(node => node.outerHTML.slice(0,100));
    return { overflow: document.documentElement.scrollWidth - innerWidth, containers, overlaps, unnamedControls, direction: document.documentElement.dir, theme: document.documentElement.dataset.theme, fontLoaded: document.fonts.check('16px Cairo'), surface: recipe('.weekly-section,.report-chart-panel'), icon: icon && {width:icon.clientWidth,height:icon.clientHeight,radius:getComputedStyle(icon).borderRadius}, background: shell && getComputedStyle(shell).backgroundImage, tokens: shell && Object.fromEntries(['--bg','--text','--muted','--surface','--glass','--hairline','--radius','--shadow','--pressure','--pressure-secondary','--glucose','--reports'].map(key => [key,getComputedStyle(shell).getPropertyValue(key)])), hiddenOverflow: [document.body,document.documentElement].some(node => ['hidden','clip'].includes(getComputedStyle(node).overflowX)) };
  });
  const clippedChartLabels = await page.locator('.reports-page .recharts-cartesian-axis-tick-value').evaluateAll(nodes=>nodes.filter(node=>{const bounds=node.getBoundingClientRect(),svg=node.closest('.recharts-surface').getBoundingClientRect();return bounds.width>0&&(bounds.left<svg.left-1||bounds.right>svg.right+1||bounds.top<svg.top-1||bounds.bottom>svg.bottom+1);}).map(node=>node.textContent));
  await page.screenshot({ path: resolve(output, `${name}.png`), fullPage: true });
  await page.screenshot({ path: resolve(output, `${name}-viewport.png`) });
  const values = name.startsWith('reports-') ? await page.locator('.report-summary strong bdi').allTextContents() : undefined;
  if (!before && meta.language === 'en' && await page.locator('.reports-page').count()) {
    assert(!/[\u0600-\u06ff]/.test(await page.locator('.reports-page').innerText()), `${name}: mixed-language report text`);
    for (const label of await page.locator('.reports-page .chart').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('aria-label')))) assert(!/[\u0600-\u06ff]/.test(label), 'Report chart descriptions are localized');
  }
  if (!before && values) assert(await page.locator('.report-stat').evaluateAll(nodes=>nodes.length===4&&nodes.every(node=>getComputedStyle(node).borderTopWidth==='1px')), 'All four shared statistic surfaces retain their border, including the last card');
  if (!before && values) assert(await page.locator('.report-stat').evaluateAll(nodes=>nodes.every(node=>getComputedStyle(node).getPropertyValue('--feature').trim()===getComputedStyle(node.closest('.living-public')).getPropertyValue(`--${node.dataset.kind}`).trim())), 'Every statistic reuses its corresponding approved feature color');
  report.cases.push({ name, ...meta, ...geometry, values, clippedChartLabels });
  if (!before) assert.deepEqual(clippedChartLabels,[],`${name}: chart axis labels are clipped`);
  if (values) for (const [index,kind] of ['pressure','glucose'].entries()) await page.locator('.report-chart-panel').nth(index).screenshot({path:resolve(output,`${name}-${kind}-chart.png`)});
  if (!before && values) { const baseline=JSON.parse(await readFile(resolve(artifactRoot,'before/report.json'),'utf8')).cases.find(item=>item.name===name); assert.deepEqual(values.map(v=>v.trim().replaceAll(',','')),baseline.values.map(v=>v.trim().replaceAll(',','')),'Seeded report statistics are preserved'); }
  if (!before) { assert(geometry.overflow <= 1, `${name}: overflow`); assert.deepEqual(geometry.containers, [], `${name}: container overflow`); assert.deepEqual(geometry.overlaps, [], `${name}: overlap`); assert.deepEqual(geometry.unnamedControls, [], `${name}: unnamed control`); assert(!geometry.hiddenOverflow); assert(geometry.fontLoaded); }
}
async function workflow(browser,language,width) {
  const {context,page}=await setup(browser,width,language,language==='ar'?'light':'dark');
  const meta={width,language,workflow:true},tag=`workflow-${width}-${language}`;
  const summary=()=>page.locator('.report-summary strong bdi').allTextContents();
  const clean=values=>values.map(value=>value.trim().replaceAll(',',''));
  const expectSummary=async expected=>page.waitForFunction(expected=>JSON.stringify([...document.querySelectorAll('.report-summary strong bdi')].map(n=>n.textContent.trim().replaceAll(',','')))===JSON.stringify(expected),expected);
  const save=async()=>{await page.locator('dialog[open] button[type=submit]').click();await page.locator('dialog[open]').waitFor({state:'hidden'});};
  const period=async index=>{await page.locator('.report-periods button').nth(index).click();assert.equal(await page.locator('.report-periods button').nth(index).getAttribute('aria-pressed'),'true');};
  const addReading=async (kind,values)=>{
    await navigate(page,'/patient/measurements');await page.locator('.measurements-actions > button').click();
    await page.locator('#reading-kind').selectOption(kind);for(const [name,value] of Object.entries(values))await page.locator(`input[name=${name}]`).fill(String(value));await save();
  };
  const removeFirstReading=async()=>{await page.locator('.measurement-entry-actions button').nth(1).click();await page.locator('dialog[open] .btn-danger').click();await page.locator('dialog[open]').waitFor({state:'hidden'});};
  try {
    await navigate(page,'/patient/reports?review=living#main');await page.locator('.report-charts .recharts-surface').first().waitFor();
    const initial=clean(await summary()),url=page.url();assert.equal(initial[2],'2/3');assert.equal(initial[3],'0/2');assert.equal(await page.locator('.report-readings li').count(),5);
    // Each ResponsiveContainer measures independently after mounting. Wait
    // for both charts' series, rather than sampling the first SVG's arrival.
    await page.waitForFunction(()=>document.querySelectorAll('.report-charts .recharts-line').length===3);
    assert.equal(await page.locator('.report-charts .recharts-line').count(),3);
    for(let i=0;i<3;i++){await period(i);await expectSummary(initial);}
    const lastUrl=page.url();assert.equal(lastUrl,url);
    for(let i=0;i<6;i++){const next=await page.locator('html').getAttribute('lang')==='ar'?'en':'ar';await page.locator('.language-toggle').click();await page.waitForFunction(next=>document.documentElement.lang===next&&document.documentElement.dir===(next==='ar'?'rtl':'ltr'),next);await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));assert.equal(page.url(),url);}
    assert.equal(await page.locator('.report-periods button').last().getAttribute('aria-pressed'),'true');await expectSummary(initial);
    for(const details of await page.locator('.report-day-details').all()){await details.locator('summary').focus();await page.keyboard.press('Enter');assert.equal(await details.locator('li').count(),7);}
    await capture(page,`${tag}-daily-averages`,meta);
    const chart=page.locator('.report-charts .chart').first();await chart.locator('.recharts-line-dots circle').first().hover();
    await page.locator('.recharts-tooltip-wrapper').filter({visible:true}).first().waitFor();await page.screenshot({path:resolve(output,`${tag}-tooltip-viewport.png`)});await chart.screenshot({path:resolve(output,`${tag}-tooltip-chart.png`)});
    await addReading('bloodPressure',{systolic:135,diastolic:85});await navigate(page,'/patient/reports');await page.waitForFunction(()=>document.querySelector('.report-readings').textContent.includes('135/85'));
    await navigate(page,'/patient/measurements');await page.locator('.measurement-entry-actions button').first().click();await page.locator('input[name=systolic]').fill('139');await save();
    await navigate(page,'/patient/reports');await page.waitForFunction(()=>document.querySelector('.report-readings').textContent.includes('139/85'));
    await navigate(page,'/patient/measurements');await removeFirstReading();await navigate(page,'/patient/reports');await expectSummary(initial);
    await navigate(page,'/patient/medications');const evening=page.locator('.dose-list li').filter({hasText:'20:00'}).locator('button');await evening.click();
    await navigate(page,'/patient/reports');await expectSummary([initial[0],initial[1],'3/3','0/2']);await period(2);await expectSummary([initial[0],initial[1],'3/3','0/2']);
    await navigate(page,'/patient/medications');await evening.click();await navigate(page,'/patient/habits');await page.locator('.habit-detail > button').nth(1).click();await page.locator('input[name=value]').fill('8');await save();
    await navigate(page,'/patient/reports');await expectSummary([initial[0],initial[1],'2/3','1/2']);await period(1);await expectSummary([initial[0],initial[1],'2/3','1/2']);
    await navigate(page,'/patient/habits');await page.locator('.habit-detail > button').nth(1).click();await page.locator('input[name=value]').fill('6');await save();await navigate(page,'/patient/reports');await expectSummary(initial);
    if(!before){
      await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('.motion-toggle').click();assert.equal(await page.locator('.living-reports').getAttribute('data-motion'),'paused');await page.locator('.motion-toggle').click();await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('.living-reports').dataset.motion==='paused');assert(await page.locator('.motion-toggle').isDisabled());
      await page.locator('.theme-select').selectOption('system');for(const os of ['dark','light']){await page.emulateMedia({colorScheme:os});await page.waitForFunction(os=>document.documentElement.dataset.theme===os,os);}
      await page.locator('.skip-link').focus();await page.keyboard.press('Enter');assert.equal(new URL(page.url()).pathname,'/patient/reports');
      for(let i=0;i<30;i++){await page.keyboard.press('Tab');assert(await page.evaluate(()=>{const el=document.activeElement,r=el.getBoundingClientRect(),bar=document.querySelector('.bottom-nav').getBoundingClientRect();return el.closest('.bottom-nav')||!bar.height||!r.height||r.top>=innerHeight||r.bottom<=bar.top+1;}),'Focus obscured by navigation');}
      await page.locator('.theme-select').selectOption(language==='ar'?'light':'dark');
    }
    const now=await page.evaluate(()=>Date.now());report.clockScenarios='Playwright advances Date for date-window scenarios. Workflow CRUD is limited to isolated in-memory browser demo sessions; source datasets and backend data are not modified.';
    // Move Date forward only: rewinding would make React Query's updatedAt
    // timestamps appear in the future and invalidate the test's assumptions.
    await page.clock.setSystemTime(now+6*86400000);await period(2);await period(0);await page.locator('.report-single-day').first().waitFor();assert.equal(await page.locator('.report-single-day').count(),2);await capture(page,`${tag}-one-recorded-day`,meta);
    await navigate(page,'/patient/measurements');await page.locator('#filter-kind').selectOption('glucose');await removeFirstReading();await navigate(page,'/patient/reports');await page.waitForFunction(()=>document.querySelectorAll('.report-charts .recharts-surface').length===1);await capture(page,`${tag}-missing-glucose-series`,meta);
    await addReading('glucose',{value:1000});await addReading('bloodPressure',{systolic:400,diastolic:300});await navigate(page,'/patient/reports');await page.locator('.report-charts .recharts-surface').nth(1).waitFor();
    await page.waitForFunction(()=>document.querySelector('.report-readings').textContent.replaceAll(',','').includes('1000'));
    const plotBounds=await page.locator('.report-charts .chart').evaluateAll(charts=>charts.map(chart=>{const r=chart.getBoundingClientRect();return [...chart.querySelectorAll('.recharts-line-dots circle')].every(dot=>{const d=dot.getBoundingClientRect();return d.left>=r.left&&d.right<=r.right&&d.top>=r.top&&d.bottom<=r.bottom;});}));assert(plotBounds.every(Boolean),'High reading points remain inside chart bounds');
    await capture(page,`${tag}-high-values-and-gaps`,meta);
    const detailCounts=await page.locator('.report-day-details').evaluateAll(nodes=>nodes.map(node=>node.querySelectorAll('li').length));assert.deepEqual(detailCounts,[2,1],'No generated points fill missing days');
    await page.clock.setSystemTime(now+14*86400000);await period(1);await period(0);await expectSummary(['—','—','0/3','0/2']);await capture(page,`${tag}-empty-seven-day-window`,meta);
    await period(1);await page.waitForFunction(()=>[...document.querySelectorAll('.report-summary strong bdi')].slice(0,2).every(node=>node.textContent.trim()!=='—'));assert.equal(await page.locator('.report-readings li').count(),5);
    report.workflows.push({language,width,status:'PASS',checks:['7/30/90-day periods and retained values','three existing chart series, keyboard daily-average lists and tooltip','six language switches preserve period/route/query/hash','measurement add/edit/delete synchronization','medication logging/undo and habit completion synchronization; current-day totals independent of period','clock-controlled empty window, one day and missing series','high values and missing-day gaps',...before?[]:['system theme light/dark','motion preferences','keyboard focus']]});
  }finally{await context.close();}
}
const probe=createServer();await new Promise((yes,no)=>{probe.once('error',no);probe.listen(5186,'127.0.0.1',yes);});await new Promise(yes=>probe.close(yes));
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js',...production?['preview']:[],'--host','127.0.0.1','--port','5186','--strictPort'],{cwd:root,stdio:'ignore'}),stopped=once(server,'exit');let browser;
try {
  let ready=false;for(let i=0;i<120;i++){try{if((await fetch(base)).ok){ready=true;break;}}catch{/* Startup only. */}await new Promise(yes=>setTimeout(yes,250));}assert(ready);
  browser=await chromium.launch({channel:'msedge',headless:true});report.browser=browser.version();
  for(const width of [1440,768,390,320])for(const language of ['ar','en'])for(const theme of ['light','dark']) {
    const {context,page}=await setup(browser,width,language,theme);
    try {
      if([1440,390].includes(width)) { await capture(page,`approved-dashboard-${width}-${language}-${theme}`,{width,language,theme,reference:true});await navigate(page,'/patient/measurements');await capture(page,`approved-measurements-${width}-${language}-${theme}`,{width,language,theme,reference:true});await navigate(page,'/patient/medications');await capture(page,`approved-medications-${width}-${language}-${theme}`,{width,language,theme,reference:true});await navigate(page,'/patient/habits');await capture(page,`approved-habits-${width}-${language}-${theme}`,{width,language,theme,reference:true}); }
      await navigate(page,'/patient/reports');await page.locator('.report-charts .recharts-surface').nth(1).waitFor();assert.equal(await page.locator('.report-summary .card').count(),4);
      await capture(page,`reports-${width}-${language}-${theme}`,{width,language,theme});
      assert.equal(await page.locator('html').getAttribute('dir'),language==='ar'?'rtl':'ltr');
      if(!before&&[1440,390].includes(width)){const reference=report.cases.find(c=>c.name===`approved-dashboard-${width}-${language}-${theme}`),current=report.cases.at(-1);assert.deepEqual(current.tokens,reference.tokens);assert.equal(current.background,reference.background);assert.deepEqual(current.surface,reference.surface,'Report chart surface must reuse the Dashboard canvas recipe');assert.deepEqual(current.icon,reference.icon,'Report icons reuse the patient feature-icon recipe');}
    } finally { await context.close(); }
  }
  for(const language of ['ar','en'])for(const width of before?[390]:[320,1440])await workflow(browser,language,width);
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.backendRequests,[]);assert.deepEqual(await hashes(),fingerprints,'Protected sources changed during verification');
  console.log(JSON.stringify({status:'PASS',cases:report.cases.length,workflows:report.workflows.length,output}));
}catch(error){report.failure=error.message;throw error;}
finally{if(browser)await browser.close();server.kill();await stopped;await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));}
