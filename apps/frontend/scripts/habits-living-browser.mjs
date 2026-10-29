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
const before = process.argv.includes('--before'), production = process.argv.includes('--production'), base = 'http://127.0.0.1:5185';
const artifactRoot = resolve(root, 'artifacts/phase1e-habits'), output = resolve(artifactRoot, before ? 'before' : 'after');
await mkdir(output, { recursive: true });
const report = { mode: production ? 'production preview' : 'Vite development', cases: [], workflows: [], errors: [], backendRequests: [] };
const protectedPaths = ['src/lib', 'src/hooks', 'src/auth', 'src/theme', 'src/app/router.tsx', 'src/i18n', 'src/pages/patient/DashboardPage.tsx', 'src/pages/patient/MeasurementsPage.tsx', 'src/pages/patient/MedicationsPage.tsx', 'src/components/health/MedicationScheduleCard.tsx', 'src/components/health/MedicationForm.tsx', 'src/styles/living-medications.css', 'src/pages/patient/ReportsPage.tsx', 'src/components/health/MeasurementFilters.tsx', 'src/components/health/MeasurementListCard.tsx', 'src/components/health/MeasurementForm.tsx', 'src/components/public', 'src/styles/globals.css', 'src/styles/living-public.css', 'src/styles/living-dashboard.css', 'src/styles/living-measurements.css', '../backend/src', '../backend/migrations', '../../design-prototypes/chroniccare-living/src'];
async function hashes() {
  const result = {};
  async function visit(path) {
    const entries = await readdir(path, { withFileTypes: true }).catch(error => { if (error.code === 'ENOTDIR') return null; throw error; });
    if (entries) { for (const entry of entries) await visit(resolve(path, entry.name)); }
    else result[relative(root, path)] = createHash('sha256').update(await readFile(path)).digest('hex');
  }
  for (const path of protectedPaths) await visit(resolve(root, path));
  const card = (await readFile(resolve(root, 'src/components/health/HabitCard.tsx'), 'utf8')).replaceAll('\r\n', '\n');
  result['HabitCard.tsx#approved-dashboard-branch'] = createHash('sha256').update(card.slice(card.indexOf('  if (!onProgress)'), card.indexOf('  return (\n    <Card'))).digest('hex');
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
  await page.locator(path.startsWith('/patient/habits') ? '.habits-page' : path.startsWith('/patient/medications') ? '.medication-schedule' : path.startsWith('/patient/dashboard') ? '.weekly-section .recharts-surface' : '.measurement-entry').first().waitFor();
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
  await page.evaluate(() => document.fonts.ready); await page.mouse.move(0, 0); await page.evaluate(() => window.scrollTo(0, 0));
  const geometry = await page.evaluate(() => {
    const visible = node => node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().height > 0 && getComputedStyle(node).visibility !== 'hidden';
    const containers = [...document.querySelectorAll('.habits-page,.habit-summary,.habits-grid,.habit-detail,.habit-card-heading,.habit-value,.habit-progress-meta,.medication-card-actions,.field,dialog[open],.dialog-heading,.header-actions,.preferences')].filter(visible).filter(node => node.scrollWidth > node.clientWidth + 1).map(node => node.className);
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
    const icon = document.querySelector('.dashboard-habits .dashboard-feature-icon,.habit-detail .dashboard-feature-icon');
    const unnamedControls = [...document.querySelectorAll('.habits-page button,.habits-page input,.habits-page select')].filter(visible).filter(node => !(node.getAttribute('aria-label') || node.textContent.trim() || (node.labels && [...node.labels].some(label => label.textContent.trim())))).map(node => node.outerHTML.slice(0,100));
    return { overflow: document.documentElement.scrollWidth - innerWidth, containers, overlaps, unnamedControls, direction: document.documentElement.dir, theme: document.documentElement.dataset.theme, fontLoaded: document.fonts.check('16px Cairo'), surface: recipe('.dashboard-habits,.habit-detail'), icon: icon && {width:icon.clientWidth,height:icon.clientHeight,radius:getComputedStyle(icon).borderRadius}, background: shell && getComputedStyle(shell).backgroundImage, tokens: shell && Object.fromEntries(['--bg','--text','--muted','--surface','--glass','--hairline','--radius','--shadow','--habits'].map(key => [key,getComputedStyle(shell).getPropertyValue(key)])), hiddenOverflow: [document.body,document.documentElement].some(node => ['hidden','clip'].includes(getComputedStyle(node).overflowX)) };
  });
  await page.screenshot({ path: resolve(output, `${name}.png`), fullPage: true });
  await page.screenshot({ path: resolve(output, `${name}-viewport.png`) });
  report.cases.push({ name, ...meta, ...geometry });
  if (!before) { assert(geometry.overflow <= 1, `${name}: overflow`); assert.deepEqual(geometry.containers, [], `${name}: container overflow`); assert.deepEqual(geometry.overlaps, [], `${name}: overlap`); assert.deepEqual(geometry.unnamedControls, [], `${name}: unnamed control`); assert(!geometry.hiddenOverflow); assert(geometry.fontLoaded); }
}
async function workflow(browser, language, width) {
  const { context, page } = await setup(browser, width, language, language === 'ar' ? 'light' : 'dark');
  const meta = { width, language, workflow: true }, tag = `workflow-${width}-${language}`;
  const cards = page.locator('.habit-detail');
  const waitCount = async n => page.waitForFunction(n => document.querySelectorAll('.habit-detail').length === n, n);
  const waitSummary = async (value,total) => page.waitForFunction(({value,total}) => { const p=document.querySelector('.habit-summary progress'); return p&&p.value===value&&p.max===(total||1); },{value,total});
  const save = async () => { await page.locator('dialog[open] button[type=submit]').click(); await page.locator('dialog[open]').waitFor({state:'hidden'}); };
  const record = async (card,value) => { await card.locator(':scope > button').click(); await page.locator('input[name=value]').fill(String(value)); await save(); };
  try {
    await navigate(page,'/patient/habits?review=living#main'); await waitCount(2); await waitSummary(0,2); const url=page.url();
    assert.match(await cards.first().locator('.habit-value').innerText(),/4,500/);
    assert.match(await cards.nth(1).locator('.habit-value').innerText(),/6/);
    if (!before) {
      if (language === 'en') assert(!/[\u0600-\u06ff]/.test(await cards.first().locator('progress').getAttribute('aria-label')), 'Seeded progress accessible name is localized');
      await cards.nth(1).locator(':scope > button').focus(); await page.keyboard.press('Enter');
      if (language === 'en') assert.equal(await page.locator('.habit-progress-form > p').first().innerText(), 'Drink water');
      await capture(page,`${tag}-seed-progress`,meta); await page.keyboard.press('Escape');
    }
    await record(cards.nth(1),8); await waitSummary(1,2);
    await record(cards.nth(1),10); assert.equal(await cards.nth(1).locator('progress').getAttribute('value'),'8');
    assert.match(await cards.nth(1).innerText(),language==='ar'?/تجاوز/:/Exceeded/);
    await record(cards.nth(1),6); await waitSummary(0,2);
    await page.locator('.measurements-heading > button,.habits-actions > button').click();
    await page.locator('input[name=title]').fill('X'); await page.locator('input[name=target]').fill('0');
    await page.locator('dialog[open] button[type=submit]').click(); await page.locator('[aria-invalid=true]').first().waitFor();
    await capture(page,`${tag}-validation`,meta);
    const title=`QA عادة ${'A'.repeat(55)}`;
    await page.locator('input[name=title]').fill(title); await page.locator('#habit-unit').selectOption('minutes'); await page.locator('input[name=target]').fill('20');
    for(let i=0;i<2;i++){const next=await page.locator('html').getAttribute('lang')==='ar'?'en':'ar';await page.locator('dialog[open]').press('Escape');await page.locator('.language-toggle').click();await page.waitForFunction(next=>document.documentElement.lang===next,next);await page.locator('.measurements-heading > button,.habits-actions > button').click();}
    // A closed add dialog intentionally starts a fresh form; it must not change saved data.
    await waitCount(2);
    await page.locator('input[name=title]').fill(title); await page.locator('#habit-unit').selectOption('minutes'); await page.locator('input[name=target]').fill('20');
    await save(); await waitCount(3); await waitSummary(0,3); await page.locator('[data-sonner-toast]').first().waitFor();
    const card=cards.filter({has:page.getByRole('heading',{name:title,exact:true})});
    await record(card,7); assert.match(await card.locator('.habit-value').innerText(),/7/); assert.equal(await card.locator('progress').getAttribute('value'),'7');
    await card.locator(':scope > button').click();
    for(const invalid of ['-1','2.5','100001']) { await page.locator('input[name=value]').fill(invalid);await page.locator('dialog[open] button[type=submit]').click();await page.locator('dialog[open] [aria-invalid=true]').waitFor(); }
    await capture(page,`${tag}-progress-validation`,meta); await page.keyboard.press('Escape');
    await record(card,25); await waitSummary(1,3);assert.equal(await card.locator('progress').getAttribute('value'),'20');
    await card.locator(':scope > button').click();assert.equal(await page.locator('input[name=value]').inputValue(),'25');await page.keyboard.press('Escape');
    await card.locator('.medication-card-actions button').first().click();await page.locator('input[name=target]').fill('30');await capture(page,`${tag}-edit`,meta);await save();
    await waitSummary(0,3); assert.equal(await card.locator('progress').getAttribute('value'),'25');
    await card.locator('.medication-card-actions button').first().click();await page.locator('#habit-unit').selectOption('cups');await page.locator('input[name=target]').fill('5');await save();assert.equal(await card.locator('progress').getAttribute('value'),'0');
    await record(card,3);
    await card.locator('.medication-card-actions button').first().click();await page.locator('#habit-unit').selectOption('times');await save();assert.equal(await card.locator('progress').getAttribute('value'),'0');await record(card,2);
    for(let i=0;i<6;i++){const next=await page.locator('html').getAttribute('lang')==='ar'?'en':'ar';await page.locator('.language-toggle').click();await page.waitForFunction(next=>document.documentElement.lang===next&&document.documentElement.dir===(next==='ar'?'rtl':'ltr'),next);await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));assert.equal(page.url(),url);}
    assert.equal(await card.locator('progress').getAttribute('value'),'2');assert.match(await card.innerText(),new RegExp(title));
    if (!before) {
      assert.equal(await card.getAttribute('aria-label'),title,'Custom names remain unchanged in accessible labels');
      await record(card,100000); await capture(page,`${tag}-long-progress`,meta);
      assert.match(await card.locator('.habit-value').innerText(),/100,000/);assert.equal(await card.locator('progress').getAttribute('value'),'5');
      await record(card,2);
    }
    await navigate(page,'/patient/dashboard');const task=page.locator('.dashboard-habits .task-row').filter({has:page.getByRole('heading',{name:title,exact:true})});await task.waitFor();assert.match(await task.innerText(),/2/);
    await navigate(page,'/patient/habits'); await waitCount(3);
    await card.locator('.medication-card-actions button').last().click();await capture(page,`${tag}-delete`,meta);
    assert(await page.locator('dialog[open]').evaluate(node=>node.contains(document.activeElement)&&!document.activeElement.classList.contains('btn-danger')));
    await page.keyboard.press('Escape');await page.locator('dialog[open]').waitFor({state:'hidden'});await waitCount(3);
    await card.locator('.medication-card-actions button').last().click();await page.locator('dialog[open] .btn-danger').click();await page.locator('dialog[open]').waitFor({state:'hidden'});await waitCount(2);await waitSummary(0,2);
    if(!before) {
      await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('.motion-toggle').click();assert.equal(await page.locator('.living-habits').getAttribute('data-motion'),'paused');await page.locator('.motion-toggle').click();
      assert(await page.evaluate(()=>!document.getAnimations().some(animation=>animation.playState==='running'&&animation.effect?.getTiming().iterations===Infinity&&animation.effect.target?.closest('.habits-page'))),'No continuous habit animation loop');
      await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('.living-habits').dataset.motion==='paused');assert(await page.locator('.motion-toggle').isDisabled());
      await page.locator('.theme-select').selectOption('system');for(const os of ['dark','light']){await page.emulateMedia({colorScheme:os});await page.waitForFunction(os=>document.documentElement.dataset.theme===os,os);}
      await page.locator('.skip-link').focus();await page.keyboard.press('Enter');assert.equal(new URL(page.url()).pathname,'/patient/habits');
      for(let i=0;i<32;i++){await page.keyboard.press('Tab');assert(await page.evaluate(()=>{const el=document.activeElement,r=el.getBoundingClientRect(),bar=document.querySelector('.bottom-nav').getBoundingClientRect();return el.closest('.bottom-nav')||!bar.height||!r.height||r.top>=innerHeight||r.bottom<=bar.top+1;}),'Focus obscured by mobile bar');}
      for(let n=2;n>0;n--){await cards.first().locator('.medication-card-actions button').last().click();await page.locator('dialog[open] .btn-danger').click();await page.locator('dialog[open]').waitFor({state:'hidden'});await waitCount(n-1);}
      await page.locator('.measurement-empty').waitFor();await waitSummary(0,0);await capture(page,`${tag}-empty`,meta);
      await page.locator('.measurement-empty button').click();await page.locator('input[name=title]').fill('Single habit');await page.locator('#habit-unit').selectOption('times');await page.locator('input[name=target]').fill('1');await save();await waitCount(1);await record(cards.first(),1);await waitSummary(1,1);await record(cards.first(),0);await waitSummary(0,1);
    }
    report.workflows.push({language,width,status:'PASS',checks:['seeded localized progress sentences','completion, exceeding target and resetting daily total','CRUD, all four units, validation bounds','goal change preserves progress; unit change resets it','six language switches preserve URL and saved state','Dashboard synchronization','delete cancellation',...before?[]:['empty and single-habit states','system light/dark','motion preferences','keyboard focus']]});
  } finally { await context.close(); }
}
const probe=createServer();await new Promise((yes,no)=>{probe.once('error',no);probe.listen(5185,'127.0.0.1',yes);});await new Promise(yes=>probe.close(yes));
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js',...production?['preview']:[],'--host','127.0.0.1','--port','5185','--strictPort'],{cwd:root,stdio:'ignore'}),stopped=once(server,'exit');let browser;
try {
  let ready=false;for(let i=0;i<120;i++){try{if((await fetch(base)).ok){ready=true;break;}}catch{/* Startup only. */}await new Promise(yes=>setTimeout(yes,250));}assert(ready);
  browser=await chromium.launch({channel:'msedge',headless:true});report.browser=browser.version();
  for(const width of [1440,768,390,320])for(const language of ['ar','en'])for(const theme of ['light','dark']) {
    const {context,page}=await setup(browser,width,language,theme);
    try {
      if([1440,390].includes(width)) { await capture(page,`approved-dashboard-${width}-${language}-${theme}`,{width,language,theme,reference:true});await navigate(page,'/patient/measurements');await capture(page,`approved-measurements-${width}-${language}-${theme}`,{width,language,theme,reference:true});await navigate(page,'/patient/medications');await capture(page,`approved-medications-${width}-${language}-${theme}`,{width,language,theme,reference:true}); }
      await navigate(page,'/patient/habits');await page.locator('.habit-detail').first().waitFor();assert.equal(await page.locator('.habit-detail').count(),2);
      await capture(page,`habits-${width}-${language}-${theme}`,{width,language,theme});
      assert.equal(await page.locator('html').getAttribute('dir'),language==='ar'?'rtl':'ltr');
      if(!before&&[1440,390].includes(width)){const reference=report.cases.find(c=>c.name===`approved-dashboard-${width}-${language}-${theme}`),current=report.cases.at(-1);assert.deepEqual(current.tokens,reference.tokens);assert.equal(current.background,reference.background);assert.deepEqual(current.surface,reference.surface,'Habit surface must reuse the Dashboard recipe');assert.deepEqual(current.icon,reference.icon,'Habit feature icons must reuse the Dashboard recipe');}
    } finally { await context.close(); }
  }
  for(const language of ['ar','en'])for(const width of before?[390]:[320,1440])await workflow(browser,language,width);
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.backendRequests,[]);assert.deepEqual(await hashes(),fingerprints,'Protected sources changed during verification');
  console.log(JSON.stringify({status:'PASS',cases:report.cases.length,workflows:report.workflows.length,output}));
}catch(error){report.failure=error.message;throw error;}
finally{if(browser)await browser.close();server.kill();await stopped;await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));}
