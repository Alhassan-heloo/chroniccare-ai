// Visual/frontend regression checks. No DB connection, credentials, or data writes.
// Auth responses below are explicit browser fixtures, not backend verification.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const root = fileURLToPath(new URL("..", import.meta.url));
const baseline = process.argv.includes("--baseline");
const warningOnly = process.argv.includes('--auth-warning');
const publicOnly = process.argv.includes('--public-only');
const nextDesign = process.argv.includes('--next-design');
const clinicalDesign = process.argv.includes('--clinical-design') || nextDesign; // Retain the previous CLI alias, validate the current composition.
const output = resolve(root, `artifacts/${clinicalDesign ? "clinical-design" : nextDesign ? "next-design" : publicOnly ? "public-foundation" : "full-design"}/${baseline ? "before" : warningOnly ? "auth-warning" : "after"}`);
await mkdir(output, { recursive: true });
const port = nextDesign || clinicalDesign ? 5199 : 5178;
const base = `http://127.0.0.1:${port}`;
const probe = createServer();
await new Promise((done, fail) => { probe.once("error", fail); probe.listen(port, "127.0.0.1", done); });
await new Promise(done => probe.close(done));
const child = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
  cwd: root, env: { ...process.env, VITE_API_URL: `${base}/api` }, stdio: "ignore",
});
const stopped = once(child, "exit");
const report = { baseURL: base, authMode: "Browser API fixtures only; no database writes", cases: [], interactions: [], errors: [], consoleWarnings: [], expectedApiErrors: [] };
let browser;
let activePage;
async function navigate(page, path) {
  await page.evaluate(async path => { const { router } = await import('/src/app/router.tsx'); await router.navigate(path); }, path);
  await page.locator('h1').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}
async function measure(page, name, screenshot = true) {
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0,0);
  await page.evaluate(() => window.scrollTo(0,0));
  const result = await page.evaluate(() => {
    const visible = el => el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0 && getComputedStyle(el).visibility !== 'hidden';
    const outside = [...document.querySelectorAll('body *')].filter(el => visible(el) && el.namespaceURI !== 'http://www.w3.org/2000/svg' && !el.closest('.sr-only,.skip-link,.public-skip,.atmosphere,.recharts-tooltip-wrapper,[data-sonner-toaster],dialog:not([open])'))
      .filter(el => { const r=el.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1; }).map(el => `${el.tagName}.${el.className}`);
    const containers=[...document.querySelectorAll('.workspace,.section-heading,.metric-card,.habit-detail,.measurement-entry,.dialog-heading,.filter-fields,.medication-card-heading,.public-masthead-inner,.public-feature,.auth-card,.public-hero-copy,.ui-feedback,.clinical-day-grid,.record-layout,.record-reading-values,.clinical-task-list,.clinical-day-heading')].filter(visible).filter(el=>el.scrollWidth>el.clientWidth+1).map(el=>el.className);
    const overlaps=[];
    for(const row of document.querySelectorAll('.preferences,.header-actions,.bottom-nav,.measurement-entry-actions,.confirmation-actions,.dialog-heading,.public-masthead-inner,.public-header-controls,.public-section-nav')) {
      const children=[...row.children].filter(visible);
      for(let i=0;i<children.length;i++) for(let j=i+1;j<children.length;j++) {
        const a=children[i].getBoundingClientRect(),b=children[j].getBoundingClientRect();
        if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1) overlaps.push(row.className);
      }
    }
    const luminance = color => {
      const channels=color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});
      return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
    };
    const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
    // Computed color-mix() may serialize as color(srgb ...), not rgb(0..255).
    // Resolve with the browser's color parser instead of misreading 0..1 channels.
    const colorCanvas = document.createElement('canvas'); colorCanvas.width = colorCanvas.height = 1;
    const colorContext = colorCanvas.getContext('2d', { willReadFrequently: true });
    const colorCache = new Map();
    const rgba = color => {
      if (!colorCache.has(color)) {
        colorContext.clearRect(0, 0, 1, 1); colorContext.fillStyle = color; colorContext.fillRect(0, 0, 1, 1);
        const [r,g,b,a] = colorContext.getImageData(0,0,1,1).data;
        colorCache.set(color, [r,g,b,a/255]);
      }
      return colorCache.get(color);
    };
    const blend=(front,back)=>front.slice(0,3).map((value,i)=>value*front[3]+back[i]*(1-front[3]));
    const background=el=>{const chain=[];for(let node=el;node;node=node.parentElement) chain.push(rgba(getComputedStyle(node).backgroundColor));return chain.reverse().reduce((back,front)=>blend(front,back),[255,255,255]);};
    const textContrastFailures=[];
    for(const el of document.querySelectorAll('.living-public *, .next-public *, .next-dashboard *, .next-app .sidebar *, .next-app .app-header *, .clinical-home *, .clinical-dashboard *, .clinical-app .sidebar *, .clinical-app .app-header *')) {
      if(!visible(el) || el.closest('svg,.sr-only,[aria-hidden=true],button:disabled,fieldset:disabled')) continue;
      if(![...el.childNodes].some(node=>node.nodeType===3 && node.textContent.trim())) continue;
      const style=getComputedStyle(el), bg=background(el), foreground=blend(rgba(style.color),bg);
      const ratio=contrast(`rgb(${foreground.join(',')})`,`rgb(${bg.join(',')})`);
      const large=parseFloat(style.fontSize)>=24 || (parseFloat(style.fontSize)>=18.66 && parseInt(style.fontWeight)>=700);
      if(ratio < (large?3:4.5)) textContrastFailures.push({element:`${el.tagName}.${el.className}`,ratio,minimum:large?3:4.5,text:el.textContent.trim().slice(0,80)});
    }
    const body=getComputedStyle(document.body);
    const button=[...document.querySelectorAll('.btn-primary')].find(visible);
    const buttonStyle=button && getComputedStyle(button);
    const contrasts={body:contrast(body.color,body.backgroundColor),...(buttonStyle ? {primary:contrast(buttonStyle.color,buttonStyle.backgroundColor)} : {})};
    return { width: innerWidth, language: document.documentElement.lang, direction: document.documentElement.dir, theme: document.documentElement.dataset.theme, fontLoaded: document.fonts.check('16px Cairo'), containers, overlaps, contrasts, textContrastFailures,
      overflow: document.documentElement.scrollWidth > innerWidth + 1, outside,
      concealed: [document.documentElement, document.body].some(el => ['hidden','clip'].includes(getComputedStyle(el).overflowX)) };
  });
  const path = screenshot ? resolve(output, `${name}.png`) : undefined;
  if (path) await page.screenshot({ path, fullPage: true });
  if (path && (result.width<=430 || nextDesign || clinicalDesign)) await page.screenshot({path:path.replace('.png','-viewport.png')});
  report.cases.push({ name, ...result, screenshot: path });
  if (!baseline) {
    assert(!result.overflow, `${name}: document overflow`);
    assert.deepEqual(result.outside, [], `${name}: content outside viewport`);
    assert.deepEqual(result.containers, [], `${name}: overflowing container`);
    assert.deepEqual(result.overlaps, [], `${name}: overlapping controls`);
    assert.deepEqual(result.textContrastFailures, [], `${name}: rendered text below AA contrast`);
    assert(Object.values(result.contrasts).every(ratio=>ratio>=4.5),`${name}: sampled text contrast below 4.5:1`);
    assert(!result.concealed, 'Global horizontal overflow must not be concealed');
    assert(result.fontLoaded, 'Local Cairo font loaded');
    assert.equal(result.direction,result.language==='ar'?'rtl':'ltr');
  }
}
async function context(language, theme, width) {
  const context = await browser.newContext({ viewport: { width, height: 960 }, colorScheme: theme === 'dark' ? 'dark' : 'light', reducedMotion: 'reduce' });
  await context.addInitScript(({language,theme}) => {
    if(!localStorage.getItem('cc-language')) localStorage.setItem('cc-language',language);
    if(!localStorage.getItem('cc-theme')) localStorage.setItem('cc-theme',theme);
  }, {language,theme});
  let user = null;
  let registered = false;
  await context.route('**/api/auth/**', async route => {
    const path = new URL(route.request().url()).pathname.split('/').at(-1);
    const body = route.request().postDataJSON();
    const error = (code,status) => route.fulfill({ status, json: { error: { code } } });
    if (path === 'register') {
      assert.equal(body.role, undefined, 'No public role selection');
      if (registered) return error('ACCOUNT_EXISTS',409);
      registered = true; return route.fulfill({ status:201,json:{user:{id:'fixture',name:body.name,email:body.email,role:'patient'}} });
    }
    if (path === 'login') {
      if (body.password !== 'Browser-fixture-password!') return error('INVALID_CREDENTIALS',401);
      const role = body.email.startsWith('doctor') ? 'doctor' : body.email.startsWith('admin') ? 'admin' : 'patient';
      user = { id:'fixture',name:'Test مستخدم',email:body.email,role };
      return route.fulfill({ json:{user,token:'browser-fixture-token-not-real',expiresAt:new Date(Date.now()+3600000).toISOString()} });
    }
    if (path === 'me') return user ? route.fulfill({json:{user}}) : error('UNAUTHENTICATED',401);
    if (path === 'logout') { user=null; return route.fulfill({status:204,body:''}); }
    return error('NOT_FOUND',404);
  });
  const page = await context.newPage();
  activePage=page;
  page.on('pageerror',error => report.errors.push(error.message));
  page.on('console',message => {
    if(warningOnly && /Failed to load resource.*503/.test(message.text())) { report.expectedApiErrors.push(message.text()); return; }
    if(['warning','error'].includes(message.type()) && !/Failed to load resource.*(401|409)/.test(message.text())) report.consoleWarnings.push(message.text());
  });
  await page.goto(base);
  return { context, page };
}
async function login(page, role) {
  await navigate(page,'/login');
  await page.locator('input[type=email]').fill(`${role}@example.test`);
  await page.locator('input[autocomplete=current-password]').fill('Browser-fixture-password!');
  await page.locator('button[type=submit]').click();
  await page.waitForURL(`**/${role}/dashboard`);
}
async function openPublicMenu(page) {
  const menu=page.locator('.public-menu-toggle');
  if(await menu.isVisible() && await menu.getAttribute('aria-expanded')==='false') await menu.click();
}
async function publicInteractions(page, language, width) {
  const tag=`${language}-${width}`;
  await navigate(page,'/register?returnTo=%2Fpatient%2Freports%3Fperiod%3D7%23summary#account');
  const original=page.url();
  await page.locator('.auth-card input').nth(0).fill('Test اسم طويل للمستخدم');
  await page.locator('input[type=email]').fill('patient@example.test');
  await openPublicMenu(page);
  if(nextDesign && width<1180) {
    await page.locator('.public-section-nav a').first().focus();await page.keyboard.press('Escape');
    assert.equal(await page.locator('.public-menu-toggle').getAttribute('aria-expanded'),'false');
    assert(await page.locator('.public-menu-toggle').evaluate(el=>el===document.activeElement));
    await openPublicMenu(page);
  }
  for(let i=0;i<4;i++) await page.locator('.language-toggle').click();
  assert.equal(page.url(),original,'Language switching preserves route/query/hash');
  assert.equal(await page.locator('.auth-card input').first().inputValue(),'Test اسم طويل للمستخدم');
  assert.equal(await page.locator('html').getAttribute('dir'),language==='ar'?'rtl':'ltr');
  await page.locator('button[type=submit]').click();
  await page.locator('[aria-invalid=true]').first().waitFor();
  await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-invalid')==='true');
  await measure(page,`${tag}-register-validation`);
  for(const [i,value] of ['Test مستخدم','patient@example.test','Browser-fixture-password!','Browser-fixture-password!'].entries()) await page.locator('.auth-card input').nth(i).fill(value);
  await page.locator('.password-toggle').click();assert.equal(await page.locator('#auth-password').getAttribute('type'),'text');
  await page.locator('.password-toggle').click();
  // Hold a fixture response to inspect the actual pending form, never the backend.
  let release;
  const pending=new Promise(done=>{release=done;});
  let submitted;
  const received=new Promise(done=>{submitted=done;});
  await page.route('**/api/auth/register',async route=>{submitted();await pending;await route.fulfill({status:201,json:{user:{id:'fixture',role:'patient'}}});},{times:1});
  await page.locator('button[type=submit]').click();await received;
  assert(await page.locator('.auth-card input').first().isDisabled());
  assert.notEqual(await page.locator('fieldset').getAttribute('disabled'),null);
  assert.equal(await page.locator('button[type=submit]').getAttribute('aria-busy'),'true');
  await measure(page,`${tag}-register-loading`);release();
  await page.waitForURL('**/login?registered=1&returnTo=*');
  await page.locator('.ui-feedback-success[role=status]').waitFor();
  await measure(page,`${tag}-register-success`);
  await page.locator('input[type=email]').fill('patient@example.test');
  await page.locator('input[autocomplete=current-password]').fill('Incorrect-password-123!');
  await page.locator('button[type=submit]').click();await page.locator('.ui-feedback-error[role=alert]').waitFor();
  await measure(page,`${tag}-login-error`);
  await openPublicMenu(page);
  await page.locator('.theme-select').selectOption('dark');await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
  await page.locator('.theme-toggle').click();assert.equal(await page.locator('.theme-select').inputValue(),'system');
  await page.locator('.theme-select').selectOption('light');await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');
  await page.locator('.theme-select').selectOption('system');
  await page.emulateMedia({colorScheme:'dark'});await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
  await measure(page,`${tag}-system-dark-login`);
  await page.emulateMedia({colorScheme:'light'});await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');
  await page.reload();await page.locator('h1').waitFor();
  assert.equal(await page.locator('.theme-select').inputValue(),'system');
  assert.equal(await page.evaluate(()=>localStorage.getItem('cc-language')),language);
  await openPublicMenu(page);
  await page.locator('.public-section-nav a').first().click();await page.waitForURL('**/#features');
  await page.waitForFunction(()=>{const box=document.querySelector('#features')?.getBoundingClientRect();return box && box.top>=-1 && box.top<innerHeight/2;},{},{timeout:2000});
  await openPublicMenu(page);
  await page.locator('.public-section-nav a[href="/#product-preview"]').click();await page.waitForURL('**/#product-preview');
  await page.waitForFunction(()=>{const box=document.querySelector('#product-preview')?.getBoundingClientRect();return box && box.top<innerHeight && box.bottom>0;},{},{timeout:2000});
  await page.evaluate(()=>window.scrollTo(0,0));
  await openPublicMenu(page);
  await page.locator('.public-section-nav a[href="/#product-preview"]').click();
  await page.waitForFunction(()=>{const box=document.querySelector('#product-preview')?.getBoundingClientRect();return box && box.top<innerHeight && box.bottom>0;},{},{timeout:2000});
  await page.keyboard.press('Tab');assert(await page.evaluate(()=>document.activeElement!==document.body));
  await page.locator('.public-hero-actions button').click();await page.waitForURL('**/patient/dashboard');
  await page.locator('.metric-number').first().waitFor();
  await navigate(page,'/patient/measurements');await page.locator('.measurement-entry').first().waitFor();
  assert.equal(await page.locator('.measurement-entry').count(),14,'Seven-day sample data remains intact');
  report.interactions.push({language,width,status:'PASS',checks:['public navigation anchors','4 language switches preserve form/route/query/hash','register validation/focus/loading/success','password visibility','fixture-only auth error','light/dark/system OS preferences and persistence','keyboard access','demo navigation and 14 seven-day readings']});
}
async function closeDialog(page) {
  await page.keyboard.press('Escape');await page.locator('dialog[open]').waitFor({state:'hidden'});
}
async function interactions(page, language, width) {
  const tag=`${language}-${width}`;
  await navigate(page,'/patient/dashboard?design=1#main');
  const url=page.url();
  for(let i=0;i<6;i++) {
    await page.locator('.language-toggle').click();
    assert.equal(page.url(),url);
    assert.equal(await page.locator('html').getAttribute('dir'),i%2===0 ? (language==='ar'?'ltr':'rtl') : (language==='ar'?'rtl':'ltr'));
  }
  for(const mode of ['light','dark','system']) {
    await page.locator('.theme-select').selectOption(mode);
    if(mode==='system') for(const os of ['dark','light']) {
      await page.emulateMedia({colorScheme:os});
      await page.waitForFunction(theme=>document.documentElement.dataset.theme===theme,os);
      await measure(page,`${tag}-system-${os}`,false);
    }
    assert.equal(await page.evaluate(()=>localStorage.getItem('cc-theme')),mode);
  }
  await page.locator('.segmented button').last().click();
  await page.locator('.chart .recharts-surface').waitFor();
  await page.locator('.chart .recharts-surface').hover({position:{x:100,y:80}});
  await page.locator('.recharts-tooltip-wrapper').filter({visible:true}).waitFor();
  await page.mouse.move(0,0);
  if(width<850) {
    await page.locator('.bottom-nav button').last().click();
    await measure(page,`${tag}-more-menu`);
    await page.locator('dialog[open] a[href="/patient/medications"]').click();
    await page.waitForURL('**/patient/medications');
  }
  await navigate(page,'/patient/dashboard');
  await page.locator('.header-actions > button').click();
  await measure(page,`${tag}-notifications`);await closeDialog(page);
  await page.locator('.add-reading').click();
  await page.locator('dialog[open] button[type=submit]').click();
  await page.locator('dialog[open] [aria-invalid=true]').first().waitFor();
  await measure(page,`${tag}-measurement-validation`);
  await page.locator('dialog[open] input[name=systolic]').fill('125');
  await page.locator('dialog[open] input[name=diastolic]').fill('85');
  await page.locator('dialog[open] button[type=submit]').click();
  await page.locator('dialog[open]').waitFor({state:'hidden'});
  await navigate(page,'/patient/measurements');
  assert.equal(await page.locator('.measurement-entry').count(),15);
  await page.locator('.measurement-entry-actions button').first().click();
  await page.locator('dialog[open] input[name=systolic]').fill('132');
  await page.locator('dialog[open] input[name=diastolic]').fill('84');
  await measure(page,`${tag}-measurement-edit`);
  await page.locator('dialog[open] button[type=submit]').click();await page.locator('dialog[open]').waitFor({state:'hidden'});
  await navigate(page,'/patient/dashboard');
  assert.equal((await page.locator('.metric-number').first().innerText()).trim(),'132/84');
  await navigate(page,'/patient/reports');assert.match(await page.locator('.report-readings').innerText(),/132\/84/);
  await page.locator('.report-periods button').last().click();await page.locator('.report-charts').waitFor();
  await navigate(page,'/patient/measurements');
  await page.locator('.measurement-entry-actions button').nth(1).click();
  await measure(page,`${tag}-measurement-delete`);
  await page.locator('dialog[open] .btn-danger').click();await page.locator('dialog[open]').waitFor({state:'hidden'});
  assert.equal(await page.locator('.measurement-entry').count(),14);
  await page.locator('#filter-kind').selectOption('glucose');assert.equal(await page.locator('.measurement-entry').count(),7);
  await navigate(page,'/patient/habits');
  await page.locator('.measurements-heading > button').click();
  const title=`Wellness روتين ${'A'.repeat(55)}`;
  await page.locator('dialog[open] input[name=title]').fill(title);
  await measure(page,`${tag}-habit-add`);
  await page.locator('dialog[open] button[type=submit]').click();await page.locator('dialog[open]').waitFor({state:'hidden'});
  let habit=page.locator('.habit-detail').filter({has:page.getByRole('heading',{name:title,exact:true})});
  await habit.locator(':scope > button').click();await page.locator('dialog[open] input[type=number]').fill('7');
  await measure(page,`${tag}-habit-progress`);
  await page.locator('dialog[open] button[type=submit]').click();await page.locator('dialog[open]').waitFor({state:'hidden'});
  for(let i=0;i<2;i++) await page.locator('.language-toggle').click();
  assert.match(await habit.locator('.habit-value').innerText(),/7/);
  await habit.locator('.medication-card-actions button').first().click();await page.locator('dialog[open] input[name=target]').fill('25');
  await page.locator('dialog[open] button[type=submit]').click();await page.locator('dialog[open]').waitFor({state:'hidden'});
  await measure(page,`${tag}-long-habit`);
  await habit.locator('.medication-card-actions button').last().click();await page.locator('dialog[open] .btn-danger').click();await page.locator('dialog[open]').waitFor({state:'hidden'});
  assert.equal(await page.locator('.habit-detail').count(),2);
  await navigate(page,'/patient/medications');
  await page.locator('.measurements-heading > button').click();
  await page.locator('dialog[open] input[name=name]').fill('Browser medication');
  await page.locator('dialog[open] input[name=dosage]').fill('As prescribed');
  await page.locator('dialog[open] input[type=time]').fill('12:30');
  await measure(page,`${tag}-medication-add`);
  await page.locator('dialog[open] button[type=submit]').click();await page.locator('dialog[open]').waitFor({state:'hidden'});
  const medication=page.locator('.medication-schedule').filter({has:page.getByRole('heading',{name:'Browser medication',exact:true})});
  await medication.locator('.dose-list button').click();await medication.locator('.dose-list button[aria-pressed=true]').waitFor();
  await medication.locator('.dose-list button').click();await medication.locator('.dose-list button[aria-pressed=false]').waitFor();
  await medication.locator('.medication-card-actions button').first().click();
  await page.locator('dialog[open] input[name=dosage]').fill('Updated prescribed dose');
  await page.locator('dialog[open] button[type=submit]').click();await page.locator('dialog[open]').waitFor({state:'hidden'});
  await medication.locator('.medication-card-actions button').last().click();await page.locator('dialog[open] .btn-danger').click();await page.locator('dialog[open]').waitFor({state:'hidden'});
  assert.equal(await page.locator('.medication-schedule').count(),2);
  // Auth presentation/contracts are exercised with intercepted API fixtures only.
  await page.locator('.session-bar button').click();await page.waitForURL('**/login?returnTo=*');
  await navigate(page,'/register');
  await page.locator('button[type=submit]').click();await page.locator('[aria-invalid=true]').first().waitFor();
  const values=['Fixture مستخدم','patient@example.test','Browser-fixture-password!','Browser-fixture-password!'];
  for(const [i,value] of values.entries()) await page.locator('.auth-card input').nth(i).fill(value);
  await page.locator('.password-toggle').click();assert.equal(await page.locator('#auth-password').getAttribute('type'),'text');
  await page.locator('.password-toggle').click();await page.locator('button[type=submit]').click();await page.waitForURL('**/login?registered=1');
  await navigate(page,'/register');for(const [i,value] of values.entries()) await page.locator('.auth-card input').nth(i).fill(value);
  await page.locator('button[type=submit]').click();await page.getByRole('alert').waitFor();
  await navigate(page,'/login');
  await page.locator('input[type=email]').fill('patient@example.test');
  await page.locator('input[autocomplete=current-password]').fill('Incorrect-password-123!');
  await page.locator('button[type=submit]').click();await page.getByRole('alert').waitFor();
  await login(page,'patient');
  assert(await page.evaluate(()=>![...Object.values(localStorage),...Object.values(sessionStorage)].includes('browser-fixture-token-not-real')));
  await page.evaluate(async()=>{const {queryClient}=await import('/src/lib/query/queryClient.ts');queryClient.setQueryData(['design-private'],'private');});
  await page.locator('.session-bar button').click();await page.waitForURL('**/login?returnTo=*');
  assert.equal(await page.evaluate(async()=>{const {queryClient}=await import('/src/lib/query/queryClient.ts');return queryClient.getQueryData(['design-private']);}),undefined);
  await page.reload();assert.equal(await page.evaluate(()=>localStorage.getItem('cc-language')),language);
  assert.equal(await page.locator('.theme-select').inputValue(),'system');
  assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
  await page.keyboard.press('Tab');assert(await page.evaluate(()=>document.activeElement!==document.body));
  report.interactions.push({language,width,status:'PASS',checks:['6 language switches; route/query/hash','system light/dark and persistence','chart toggle/tooltip','More menu and notifications','measurement CRUD/filter/dashboard/report sync','habit CRUD/progress/long text','medication CRUD and dose undo','auth validation/register/duplicate/login/logout with API fixtures','memory-only token/cache isolation','keyboard focus']});
}
try {
  for(let i=0;i<80;i++) {
    try { if((await fetch(base)).ok) break; } catch { /* Vite starting */ }
    await new Promise(done=>setTimeout(done,200));
  }
  browser = await chromium.launch({channel:'msedge',headless:true});
  if(clinicalDesign) {
    for(const language of ['ar','en']) for(const theme of ['light','dark']) for(const width of [1440,768,390]) {
      const {context:c,page}=await context(language,theme,width);
      await measure(page,`${language}-${theme}-${width}-home`);
      if(!baseline) {
        assert.equal(await page.locator('.clinical-home .clinical-record-preview').count(),1);
        assert.equal(await page.locator('.launch-hero,.bento-grid,.product-window').count(),0);
        await page.locator('.record-days button').first().click();
        assert.match(await page.locator('.record-reading-values').innerText(),/122/);
        await page.locator('.record-days button').last().click();
        assert.match(await page.locator('.record-reading-values').innerText(),/120/);
        await page.locator('.clinical-tools [role=tab]').last().click();await page.locator('.clinical-tools .assistant-interface').waitFor();if(width===390)await measure(page,`${language}-${theme}-${width}-assistant-preview`);
        await page.locator('.clinical-tools [role=tab]').first().focus();await page.keyboard.press(language==='ar'?'ArrowLeft':'ArrowRight');
        assert.equal(await page.locator('.clinical-tools [role=tab]').nth(1).getAttribute('aria-selected'),'true');
        await page.locator('.clinical-tools [role=tab]').first().click();
      }
      if(baseline) {await navigate(page,'/register');await page.locator('.auth-card > .btn-secondary').click();} else {
        await page.evaluate(()=>window.scrollTo(0,0));await openPublicMenu(page);
        const menu=page.locator('.public-menu-toggle');if(await menu.isVisible()){await page.locator('.public-section-nav a').first().focus();await page.keyboard.press('Escape');assert.equal(await menu.getAttribute('aria-expanded'),'false');assert(await menu.evaluate(el=>el===document.activeElement));}
        await page.locator('.public-hero-actions button').click();
      }
      await page.waitForURL('**/patient/dashboard');
      await page.locator('.weekly-section .recharts-surface').waitFor();await measure(page,`${language}-${theme}-${width}-dashboard`);
      if(!baseline) {
        assert.equal(await page.locator('.clinical-day-grid').count(),1);assert.equal(await page.locator('.dashboard-board,.routine-strip').count(),0);
        assert.equal(await page.locator('.clinical-dashboard').evaluate(el=>getComputedStyle(el).animationName),'none','Reduced-motion disables content entrances');
        const layout=await page.evaluate(()=>({tasks:document.querySelector('.clinical-today').getBoundingClientRect().toJSON(),chart:document.querySelector('.clinical-history').getBoundingClientRect().toJSON()}));assert(layout.chart.top>=layout.tasks.bottom-1,'Tasks precede weekly review');
        if(width===390&&theme==='light') await interactions(page,language,width);
        if(width===768) for(const name of ['measurements','medications','habits','reports']) {await navigate(page,`/patient/${name}`);await measure(page,`${language}-${theme}-${width}-${name}`);}
      }
      await c.close();
    }
    if(!baseline) {
      const {context:c,page}=await context('en','light',1440);await navigate(page,'/register');await page.locator('.auth-card > .btn-secondary').click();await page.waitForURL('**/patient/dashboard');await page.locator('.clinical-dashboard').waitFor();await page.locator('.weekly-section .recharts-surface').waitFor();
      await page.locator('.theme-select').selectOption('system');
      for(const os of ['dark','light']) {await page.emulateMedia({colorScheme:os});await page.waitForFunction(theme=>document.documentElement.dataset.theme===theme,os);await measure(page,`system-${os}-1440-dashboard`);}
      for(const role of ['doctor','admin']) {await login(page,role);await measure(page,`${role}-shell`);await navigate(page,'/patient/dashboard');await page.waitForURL(`**/${role}/dashboard`);assert.equal(await page.locator('.sidebar a[href="/patient/measurements"]').count(),0);await page.locator('.session-bar button').click();await page.waitForURL('**/login?returnTo=*');}
      await c.close();
      const motion=await browser.newContext({viewport:{width:1440,height:960},reducedMotion:'no-preference'});const motionPage=await motion.newPage();await motionPage.goto(base);assert.equal(await motionPage.locator('.clinical-record-preview').evaluate(el=>getComputedStyle(el).animationName),'clinical-enter');
      await navigate(motionPage,'/#assistant-preview');assert.equal(await motionPage.locator('.clinical-tools [role=tab]').last().getAttribute('aria-selected'),'true');await motionPage.locator('.clinical-tools [role=tab]').first().click();assert.equal(await motionPage.locator('.clinical-tools [role=tab]').first().getAttribute('aria-selected'),'true');await navigate(motionPage,'/#assistant-preview');assert.equal(await motionPage.locator('.clinical-tools [role=tab]').last().getAttribute('aria-selected'),'true');await motion.close();
    }
  } else if(publicOnly) {
    for(const language of ['ar','en']) {
      for(const [theme,width] of [['light',320],['dark',390],['dark',430],['system',768],['light',1024],['light',1440]]) {
        const {context:c,page}=await context(language,theme,width);
        for(const path of ['/','/login','/register']) {
          await navigate(page,path);
          await measure(page,`${language}-${theme}-${width}-${path.slice(1)||'home'}`);
        }
        if(!baseline && width===390) await publicInteractions(page,language,width);
        await c.close();
      }
    }
  } else if(warningOnly) {
    for(const [language,width] of [['ar',320],['en',1024]]) {
      const {context:c,page}=await context(language,'light',width);
      await login(page,'patient');
      await page.route('**/api/auth/logout',route=>route.fulfill({status:503,json:{error:{code:'UNAVAILABLE'}}}),{times:1});
      await page.locator('.session-bar button').click();
      await page.waitForURL('**/login?returnTo=*');
      await page.getByText(/Signed out locally|تم الخروج محليًا/).waitFor();
      await measure(page,`${language}-${width}-logout-warning`);
      report.interactions.push({language,width,status:'PASS',checks:['Failed server logout still clears local session and displays warning after protected shell unmounts']});
      await c.close();
    }
  } else {
  for(const [lang,theme,width] of [['en','light',1440],['ar','dark',390]]) {
    const {context:c,page}=await context(lang,theme,width);
    for(const path of ['/','/login','/register']) { await navigate(page,path); await measure(page,`${lang}-${theme}-${width}-${path.slice(1)||'home'}`); }
    await page.locator('.auth-card > .btn-secondary').click();
    await page.waitForURL('**/patient/dashboard');
    for(const name of ['dashboard','measurements','medications','habits','reports','assistant','profile']) {
      await navigate(page,`/patient/${name}`);
      if(name==='dashboard') await page.locator('.weekly-section .recharts-surface').waitFor();
      await measure(page,`${lang}-${theme}-${width}-patient-${name}`);
    }
    for(const role of ['doctor','admin']) {
      await login(page,role);
      await navigate(page,`/${role}/dashboard`); await measure(page,`${lang}-${theme}-${width}-${role}`);
      if(role==='doctor') { await navigate(page,'/doctor/patients');await measure(page,`${lang}-${theme}-${width}-doctor-patients`); }
      if(!baseline) {
        await navigate(page,'/patient/dashboard');await page.waitForURL(`**/${role}/dashboard`);
        assert.equal(await page.locator('.sidebar a[href="/patient/measurements"]').count(),0);
      }
      await page.locator('.session-bar button,.session-actions button').last().click();
    }
    await c.close();
  }
  if(!baseline) {
    for(const [lang,theme,width] of [['ar','light',320],['en','dark',430],['ar','system',768],['en','light',1024]]) {
      const {context:c,page}=await context(lang,theme,width);
      for(const path of ['/','/login','/register']) {await navigate(page,path);await measure(page,`${lang}-${theme}-${width}-${path.slice(1)||'home'}`);}
      await page.locator('.auth-card > .btn-secondary').click();await page.waitForURL('**/patient/dashboard');
      for(const name of ['dashboard','measurements','medications','habits','reports']) {await navigate(page,`/patient/${name}`);await measure(page,`${lang}-${theme}-${width}-patient-${name}`);}
      if(width===320 || width===1024) await interactions(page,lang,width);
      await c.close();
    }
  }
  }
  assert.deepEqual(report.errors,[]);
  assert.deepEqual(report.consoleWarnings,[],'Unexpected browser warnings/errors');
  console.log(JSON.stringify({status:'PASS',cases:report.cases.length,output}));
} catch(error) {
  report.errors.push(error.message);console.error(error.message);process.exitCode=1;
  if(activePage && !activePage.isClosed()) {report.failureURL=activePage.url();await activePage.screenshot({path:resolve(output,'failure.png'),fullPage:true});}
}
finally {
  if(browser) await browser.close(); child.kill();await stopped;
  await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));
}
