// Real Express + dedicated PostgreSQL test database. No application database writes.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { parseEnv } from 'node:util';
import { randomUUID, randomBytes } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url)),backend=resolve(root,'../backend');
const require=createRequire(import.meta.url),backendRequire=createRequire(resolve(backend,'package.json'));
const { chromium }=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright'),{Client}=backendRequire('pg');
const env=parseEnv(await readFile(resolve(backend,'.env'),'utf8'));
const databaseUrl=process.env.TEST_DATABASE_URL||env.TEST_DATABASE_URL;
assert(databaseUrl&&new URL(databaseUrl).pathname.endsWith('_test'),'A dedicated test database is required');
const application=new URL(process.env.DATABASE_URL||env.DATABASE_URL),target=new URL(databaseUrl);
assert(application.host!==target.host||application.pathname!==target.pathname,'Application and test databases must differ');
const db=new Client({connectionString:databaseUrl,connectionTimeoutMillis:5000});
const base='http://127.0.0.1:5188',api='http://127.0.0.1:3310/api';
const output=resolve(root,process.env.MEASUREMENTS_OUTPUT || 'artifacts/measurements-integration');
await mkdir(output,{recursive:true});
const report={checks:[],screenshots:[],errors:[],expectedFailures:[],http:[],authHttp:[],serviceLogs:[]};
const emails=[`${randomUUID()}@browser-measurements.example.test`,`${randomUUID()}@browser-measurements.example.test`];
const password=randomBytes(24).toString('hex'),services=[];
let browser,stage='setup',fault=false;
async function start(args,cwd,environment,port){
  const probe=createServer();await new Promise((yes,no)=>{probe.once('error',no);probe.listen(port,'127.0.0.1',yes);});await new Promise(yes=>probe.close(yes));
  const child=spawn(process.execPath,args,{cwd,env:{...process.env,...environment},stdio:['ignore','pipe','pipe']});services.push({child,stopped:once(child,'exit')});
  const capture=(stream,label)=>stream.on('data',chunk=>{if(report.serviceLogs.length<40)report.serviceLogs.push({port,label,message:String(chunk).replace(/postgres(?:ql)?:\/\/\S+/gi,'[database-url]').slice(0,500)});});
  capture(child.stdout,'stdout');capture(child.stderr,'stderr');child.on('exit',code=>report.serviceLogs.push({port,label:'exit',message:String(code)}));
  for(let i=0;i<120;i++){try{await fetch(`http://127.0.0.1:${port}`);return;}catch{/* Startup only. */}await new Promise(yes=>setTimeout(yes,250));}throw Error('Test service did not start');
}
async function navigate(page,path){
  await page.evaluate(async path=>{const{router}=await import('/src/app/router.tsx');await router.navigate(path);},path);
  await page.waitForURL(`${base}${path}`);await page.locator('h1').waitFor();
}
async function login(page,email){
  await page.locator('input[type=email]').fill(email);await page.locator('input[autocomplete=current-password]').fill(password);
  const response=page.waitForResponse(r=>r.url()===`${api}/auth/login`&&r.status()===200);
  await page.locator('.auth-card button[type=submit]').click();
  const session=await(await response).json();assert.equal(session.token,undefined);
  await page.waitForURL(url=>url.origin===base&&url.pathname.startsWith('/patient/'));
  const sessionCookie=(await page.context().cookies(api)).find(cookie=>cookie.name==='cc_session'||cookie.name==='__Host-cc_session');
  assert(sessionCookie?.httpOnly,'The browser session should use an HttpOnly cookie');
  return sessionCookie.value;
}
async function logout(page){await page.locator('.session-bar button').click();await page.waitForURL('**/login?returnTo=*');}
async function save(page){await page.locator('dialog[open] button[type=submit]').click();await page.locator('dialog[open]').waitFor({state:'hidden'});}
const addPanel='.measurement-add-panel';
async function openAdd(page){
  await page.locator('.measurements-heading > .add-reading').click();
  await page.locator(addPanel).waitFor();
  assert.equal(await page.locator('dialog[open]').count(),0);
}
async function openAddFromDashboard(page){
  await navigate(page,'/patient/dashboard');
  await page.locator('.dashboard-record-pressure').click();
  await page.waitForURL(`${base}/patient/measurements?record=pressure`);
  await page.locator(addPanel).waitFor();
  assert.equal(await page.locator('dialog[open]').count(),0);
  await page.waitForFunction(()=>document.activeElement?.name==='systolic');
}
async function backToDashboard(page){
  await page.locator('.measurement-save-feedback a[href="/patient/dashboard"]').click();
  await page.waitForURL(`${base}/patient/dashboard`);
}
async function saveNew(page){
  await page.locator(`${addPanel} button[type=submit]`).click();
  await page.locator(addPanel).waitFor({state:'hidden'});
  await page.locator('.measurement-save-feedback [role=status]').waitFor();
}
async function list(token){const response=await fetch(`${api}/measurements`,{headers:{Authorization:`Bearer ${token}`}});assert.equal(response.status,200);return(await response.json()).measurements;}
async function shot(page,name){
  await page.evaluate(()=>document.fonts.ready);await page.mouse.move(0,0);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1 ? [] :
    [...document.querySelectorAll('body *')].filter(element=>{const box=element.getBoundingClientRect();return box.width>0&&(box.left< -1||box.right>innerWidth+1);})
      .slice(0,12).map(element=>element.classList.value||element.tagName));
  assert.equal(overflow.length,0,`No horizontal overflow in ${name}: ${overflow.join(', ')}`);
  const path=resolve(output,`${name}.png`);await page.screenshot({path,fullPage:true});report.screenshots.push(path);
}
async function preference(page, change){
  await page.locator('.header-preferences-button').click();
  const options=page.locator('dialog[open] .workspace-preferences');
  await options.waitFor();
  await change(options);
  await page.keyboard.press('Escape');
  await options.waitFor({state:'hidden'});
}
async function setTheme(page,theme){await preference(page,options=>options.locator('.theme-select').selectOption(theme));}
async function toggleLanguage(page){await preference(page,options=>options.locator('.language-toggle').click());}
try{
  await db.connect();
  // Migrations only on the guarded test connection; never change process .env files.
  const migrate=spawn(process.execPath,['dist/db/migrate.js'],{cwd:backend,env:{...process.env,...env,NODE_ENV:'test',DATABASE_URL:databaseUrl},stdio:'ignore'});
  const [migrationCode]=await once(migrate,'exit');assert.equal(migrationCode,0);
  await start(['dist/server.js'],backend,{...env,NODE_ENV:'test',DATABASE_URL:databaseUrl,HOST:'127.0.0.1',PORT:'3310',CORS_ORIGINS:base},3310);
  assert.equal((await fetch(`${api}/health`)).status,200);assert.equal((await fetch(`${api}/health/ready`)).status,200);
  // Register dedicated patients before starting the browser. Login in the
  // browser so each session follows the server's current rotation policy.
  for(let index=0;index<emails.length;index++){
    const registered=await fetch(`${api}/auth/register`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:`Patient ${index===0?'A':'B'}`,email:emails[index],password})});assert.equal(registered.status,201);
  }
  await start(['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5188','--strictPort'],root,{VITE_API_URL:api},5188);
  browser=await chromium.launch({channel:'msedge',headless:true});report.browser=browser.version();
  const context=await browser.newContext({viewport:{width:1440,height:960},reducedMotion:'reduce'});
  await context.addInitScript(()=>{localStorage.setItem('cc-language','en');localStorage.setItem('cc-theme','dark');});
  const page=await context.newPage();
  // Password hashing can be slower while Edge, Vite and PostgreSQL share a
  // resource-constrained development machine; functional waits remain bounded.
  page.setDefaultTimeout(90000);
  page.on('pageerror',error=>report.errors.push(error.message));
  page.on('console',message=>{if(['error','warning'].includes(message.type())){
    const signedOutSessionCheck=message.location().url===`${api}/auth/me`&&message.text().includes('401');
    if(signedOutSessionCheck||(/Failed to load resource.*(401|503)/.test(message.text())&&(fault||stage==='expiration')))report.expectedFailures.push({stage,message:message.text()});else report.errors.push(message.text());
  }});
  page.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/api/auth/')){let shape;try{const body=request.postDataJSON();shape=body&&typeof body==='object'?{keys:Object.keys(body).sort(),nameLength:String(body.name??'').length,emailLength:String(body.email??'').length,passwordLength:String(body.password??'').length}:undefined;}catch{/* No JSON body. */}report.authHttp.push({stage,method:request.method(),url:new URL(request.url()).origin+new URL(request.url()).pathname,...shape?{shape}:{}});}});
  page.on('response',response=>{if(response.url().startsWith(`${api}/measurements`))report.http.push({stage,method:response.request().method(),status:response.status()});});
  stage='patient-A-login';await page.goto(`${base}/login`);let tokenA=await login(page,emails[0]);
  assert(await page.evaluate(token=>![...Object.values(localStorage),...Object.values(sessionStorage)].includes(token),tokenA),'Bearer token stays in memory');
  await navigate(page,'/patient/measurements');await page.locator('.measurement-empty').waitFor();assert.equal((await list(tokenA)).length,0);
  stage='failed-create';await openAddFromDashboard(page);await page.locator(`${addPanel} input[name=systolic]`).fill('135');await page.locator(`${addPanel} input[name=diastolic]`).fill('85');
  fault=true;await page.route(`${api}/measurements`,route=>route.request().method()==='POST'?route.fulfill({status:503,json:{error:{code:'TEST_UNAVAILABLE'}}}):route.continue());
  const failed=page.waitForResponse(r=>r.url()===`${api}/measurements`&&r.request().method()==='POST'&&r.status()===503);
  await page.locator(`${addPanel} button[type=submit]`).click();await failed;await page.locator('[data-sonner-toast][data-type=error]').first().waitFor();
  assert(await page.locator(addPanel).isVisible());assert.equal((await list(tokenA)).length,0);assert.equal(await page.locator('.measurement-entry').count(),0);
  assert.equal(await page.locator('.measurement-save-feedback [role=status]').textContent(),'');
  await page.unroute(`${api}/measurements`);fault=false;
  stage='create';await page.evaluate(()=>{const button=document.querySelector('.measurement-add-panel button[type=submit]');button.click();button.click();button.click();});await page.locator(addPanel).waitFor({state:'hidden'});await page.waitForFunction(()=>document.querySelectorAll('.measurement-entry').length===1);
  let readings=await list(tokenA);const id=readings[0].id,timestamp=readings[0].recordedAt;assert.equal(readings[0].isExample,false);
  assert.equal(await page.locator('.measurement-entry time').getAttribute('dateTime'),timestamp);
  const committed=await db.query('SELECT patient_id,recorded_at FROM chroniccare.measurements WHERE id=$1',[id]);assert.equal(committed.rowCount,1);assert.equal(committed.rows[0].recorded_at.toISOString(),timestamp);
  await page.locator('.measurement-save-feedback [role=status]').filter({hasText:'Reading saved to your account'}).waitFor();
  await backToDashboard(page);
  const pressureCard=page.locator('.canvas-readings .metric-card').first();
  await pressureCard.locator('.metric-number').filter({hasText:'135/85'}).waitFor();
  assert.equal(await pressureCard.locator('time').getAttribute('datetime'),timestamp);
  assert.equal(await pressureCard.locator('.metric-unit').textContent(),'mmHg');
  await page.locator('.dashboard-measurement-history').click();
  await page.waitForURL(`${base}/patient/measurements`);
  assert.equal(await page.locator(addPanel).isVisible(),false);
  assert.equal(await page.locator('.patient-page-header h1').count(),1);
  stage='mobile-filtered-save';
  page.setDefaultTimeout(25000);
  await page.setViewportSize({width:320,height:844});
  await toggleLanguage(page);
  assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
  await openAddFromDashboard(page);
  await page.locator(`${addPanel} .btn-secondary`).click();
  await page.waitForURL(`${base}/patient/measurements`);
  await page.locator('.bottom-nav a.add-nav').click();
  await page.waitForURL(`${base}/patient/measurements?record=pressure`);
  await page.locator(addPanel).waitFor();
  await page.waitForFunction(()=>document.activeElement?.name==='systolic');
  await page.locator('.measurement-filter-panel > summary').click();
  const fromDate=page.locator('.filter-fields input[type=date]').first();
  await fromDate.fill('2099-01-01');
  await page.locator(`${addPanel} input[name=systolic]`).fill('127');
  await page.locator(`${addPanel} input[name=diastolic]`).fill('81');
  await saveNew(page);
  assert.equal(await fromDate.inputValue(),'2099-01-01');
  assert.equal(await page.locator('.measurement-entry').count(),0);
  const newest=(await list(tokenA))[0];
  assert.equal(newest.systolic,127);
  await page.locator('.measurement-save-feedback button').click();
  await page.locator('.measurement-filter-panel > summary').click();
  const firstRow=page.locator('.measurement-entry').first();
  assert.equal(await firstRow.locator('time').getAttribute('datetime'),newest.recordedAt);
  assert.equal(await firstRow.locator('.measurement-entry-value > span').textContent(),'ملم زئبق');
  assert.equal(await page.locator('.measurement-day').count(),1);
  assert.equal(await page.locator('.measurement-day-list > li').count(),2);
  for(const theme of ['light','dark']){
    await setTheme(page,theme);
    const style=await page.addStyleTag({content:'html { font-size: 200% !important; }'});
    try {
      const fits=await firstRow.evaluate(row=>[row, row.querySelector('time'), row.querySelector('.measurement-entry-value strong'), row.querySelector('.measurement-entry-value > span'), document.querySelector('.measurement-day-title')].every(el=>{const box=el.getBoundingClientRect();return box.left>=0&&box.right<=innerWidth+1&&el.scrollWidth<=el.clientWidth+1;}));
      assert(fits,'Arabic date, reading and unit fit the 320px viewport with 200% text');
      await shot(page,`day-log-320-ar-${theme}-200`);
    } finally { await style.evaluate(node=>node.remove()); }
  }
  stage='measurement-trend';
  assert(await firstRow.isVisible(),'The daily log is visible before expanding the trend');
  const trend=page.locator('.measurements-trend-disclosure');
  const chart=trend.locator('.precision-chart[data-kind="pressure"]');
  assert.equal(await trend.getAttribute('open'),null);
  assert.equal(await chart.count(),0);
  await trend.locator(':scope > summary').click();
  await chart.locator('svg.recharts-surface').waitFor({state:'visible'});
  const dots=chart.locator('circle.recharts-line-dot');
  assert.equal(await dots.count(),2,'The chart plots both pressure values for the recorded day');
  assert(await dots.first().isVisible());
  assert(await dots.last().isVisible());
  await chart.locator('.precision-values > summary').click();
  const sourceValues=chart.locator('.precision-values li bdi');
  assert.deepEqual(await sourceValues.allTextContents(),['131 mmHg','83 mmHg'],'The chart uses the daily averages of 135/85 and 127/81');
  await backToDashboard(page);
  await pressureCard.locator('.metric-number').filter({hasText:'127/81'}).waitFor();
  assert.equal(await pressureCard.locator('time').getAttribute('datetime'),newest.recordedAt);
  assert.equal(await pressureCard.locator('.metric-unit').textContent(),'ملم زئبق');
  await page.locator('.dashboard-measurement-history').click();
  await page.waitForURL(`${base}/patient/measurements`);
  await firstRow.locator('.measurement-entry-actions button').last().click();
  await page.locator('dialog[open] .btn-danger').click();
  await page.waitForFunction(()=>document.querySelectorAll('.measurement-entry').length===1);
  await toggleLanguage(page);
  await page.setViewportSize({width:1440,height:960});
  stage='edit';await page.locator('.measurement-entry-actions button').first().click();await page.locator('input[name=systolic]').fill('140');await page.locator('input[name=diastolic]').fill('90');await save(page);
  await page.waitForFunction(()=>document.querySelector('.measurement-entry-value').textContent.includes('140/90'));readings=await list(tokenA);assert.equal(readings[0].recordedAt,timestamp);
  stage='dashboard-sync';await navigate(page,'/patient/dashboard');
  await page.locator('.canvas-readings .metric-number').filter({hasText:'140/90'}).waitFor();
  assert.match(await page.locator('.command-welcome h1').innerText(),/Patient A/);
  await navigate(page,'/patient/reports');await page.locator('.report-readings').filter({hasText:'140/90'}).waitFor();
  stage='report-periods';const historicalResponse=await fetch(`${api}/measurements`,{method:'POST',headers:{Authorization:`Bearer ${tokenA}`,'Content-Type':'application/json'},body:JSON.stringify({kind:'glucose',value:88,recordedAt:new Date(Date.now()-30*86400000).toISOString()})});assert.equal(historicalResponse.status,201);const historical=(await historicalResponse.json()).measurement;await page.evaluate(async()=>{const{queryClient}=await import('/src/lib/query/queryClient.ts');await queryClient.invalidateQueries({queryKey:['patient','reports']});});await page.locator('.report-periods button').last().click();await page.waitForFunction(()=>document.querySelector('.report-readings')?.textContent.includes('88'));await page.locator('.report-periods button').first().click();await page.waitForFunction(()=>!document.querySelector('.report-readings')?.textContent.includes('88'));assert.equal((await fetch(`${api}/measurements/${historical.id}`,{method:'DELETE',headers:{Authorization:`Bearer ${tokenA}`}})).status,204);await page.evaluate(async()=>{const{queryClient}=await import('/src/lib/query/queryClient.ts');await queryClient.invalidateQueries({queryKey:['patient','reports']});});
  stage='logout-login';await logout(page);assert.equal(await page.evaluate(async()=>{const{queryClient}=await import('/src/lib/query/queryClient.ts');return queryClient.getQueryCache().getAll().length;}),0,'Logout must clear protected React Query data');assert.equal((await fetch(`${api}/measurements`,{headers:{Authorization:`Bearer ${tokenA}`}})).status,401);tokenA=await login(page,emails[0]);
  assert.equal((await list(tokenA))[0].id,id);stage='logout-login-navigation';await navigate(page,'/patient/measurements');stage='logout-login-render';
  await page.locator('.measurement-entry, .measurement-empty, .measurement-results [role=alert]').first().waitFor({timeout:20000});assert.equal(await page.locator('.measurement-entry').count(),1,'The persisted reading must render after logging in again');
  stage='viewport-language-theme';for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:width===1440?960:844});for(const language of ['ar','en']){if(await page.locator('html').getAttribute('lang')!==language){await toggleLanguage(page);await page.waitForFunction(language=>document.documentElement.lang===language,language);}for(const theme of ['light','dark']){await setTheme(page,theme);await shot(page,`real-measurements-${width}-${language}-${theme}`);assert.equal((await list(tokenA)).length,1);}}}
  await page.setViewportSize({width:1440,height:960});await setTheme(page,'system');for(const os of ['dark','light']){await page.emulateMedia({colorScheme:os});await page.waitForFunction(os=>document.documentElement.dataset.theme===os,os);}
  stage='patient-B-isolation';await logout(page);await navigate(page,'/login');const tokenB=await login(page,emails[1]);await navigate(page,'/patient/measurements');await page.locator('.measurement-empty').waitFor();assert.equal((await list(tokenB)).length,0);
  for(const method of ['GET','PUT','DELETE']){const response=await fetch(`${api}/measurements/${id}`,{method,headers:{Authorization:`Bearer ${tokenB}`,...method==='PUT'?{'Content-Type':'application/json'}:{}},...method==='PUT'?{body:JSON.stringify({kind:'glucose',value:99})}:{}});assert.equal(response.status,404);}
  await openAdd(page);await page.locator(`${addPanel} select[name=kind]`).selectOption('glucose');await page.locator(`${addPanel} input[name=value]`).fill('99.25');await saveNew(page);await page.locator('.measurement-entry').waitFor();assert.equal((await list(tokenB)).length,1);
  stage='dashboard-appearance';
  const glucose=(await list(tokenB))[0];
  const addedPressure=await fetch(`${api}/measurements`,{method:'POST',headers:{Authorization:`Bearer ${tokenB}`,'Content-Type':'application/json'},body:JSON.stringify({kind:'bloodPressure',systolic:123,diastolic:78})});
  assert.equal(addedPressure.status,201);
  const {measurement: pressure}=await addedPressure.json();
  await page.evaluate(async()=>{
    const {queryClient}=await import('/src/lib/query/queryClient.ts');
    await queryClient.invalidateQueries({queryKey:['patient','measurements']});
  });
  await toggleLanguage(page);
  await backToDashboard(page);
  const glucoseCard=page.locator('.canvas-readings .metric-card').last();
  await pressureCard.locator('.metric-number').filter({hasText:'123/78'}).waitFor();
  await glucoseCard.locator('.metric-number').filter({hasText:'99.25'}).waitFor();
  assert.equal(await pressureCard.locator('time').getAttribute('datetime'),pressure.recordedAt);
  assert.equal(await glucoseCard.locator('time').getAttribute('datetime'),glucose.recordedAt);
  assert.equal(await glucoseCard.locator('.metric-unit').textContent(),'mg/dL');
  for(const width of [1440,390,320]){
    await page.setViewportSize({width,height:width===1440?960:844});
    for(const theme of ['light','dark']){
      await setTheme(page,theme);
      assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
      await shot(page,`patient-dashboard-${width}-ar-${theme}`);
      if(width!==320){
        await page.locator('.dashboard-measurement-history').click();
        await page.waitForURL(`${base}/patient/measurements`);
        await page.locator('.measurement-entry').filter({hasText:'123/78'}).waitFor();
        await shot(page,`patient-measurements-${width}-ar-${theme}`);
        await navigate(page,'/patient/dashboard');
      }
    }
  }
  stage='sibling-shell';
  for(const [name, target] of [
    ['medications','.medications-page'],
    ['habits','.habits-page'],
    ['reports','.reports-page'],
    ['assistant','.evolution-assistant'],
  ]){
    await navigate(page,`/patient/${name}`);
    await page.locator(target).waitFor();
    for(const width of [1440,390]){
      await page.setViewportSize({width,height:844});
      assert.equal(await page.locator('.app-header').count(),1);
      assert.equal(await page.locator('.sidebar').isVisible(),width===1440);
      assert.equal(await page.locator('.bottom-nav').isVisible(),width===390);
      assert.equal(await page.locator('.bottom-nav button.add-nav').count(),1);
      assert.equal(await page.locator('.patient-reading-shell').count(),0);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`No overflow in ${name} at ${width}`);
    }
  }
  report.checks.push('shared page heading and mobile pressure shortcut', 'navigation and layout of medications, habits, reports and assistant at desktop and mobile widths');
  await toggleLanguage(page);
  await page.setViewportSize({width:1440,height:960});
  assert.equal((await fetch(`${api}/measurements/${pressure.id}`,{method:'DELETE',headers:{Authorization:`Bearer ${tokenB}`}})).status,204);
  stage='authentication-only';await logout(page);assert.equal(await page.locator('.auth-demo-intro').count(),0);await page.goto(base+'/patient/measurements');await page.waitForURL('**/login?returnTo=*');tokenA=await login(page,emails[0]);await navigate(page,'/patient/measurements');await page.locator('.measurement-entry').waitFor();assert.equal((await list(tokenA)).length,1);
  stage='read-failure';fault=true;await page.route(`${api}/measurements`,route=>route.fulfill({status:503,json:{error:{code:'TEST_UNAVAILABLE'}}}));await page.evaluate(async()=>{const{queryClient}=await import('/src/lib/query/queryClient.ts');await queryClient.invalidateQueries({queryKey:['patient','measurements']});});
  await page.locator('.measurement-results [role=alert]').waitFor();assert.equal(await page.locator('.measurement-entry').count(),0);await page.unroute(`${api}/measurements`);fault=false;await page.locator('.measurement-results [role=alert] button').click();await page.locator('.measurement-entry').waitFor();
  stage='delete';await page.locator('.measurement-entry-actions button').last().click();await page.locator('dialog[open] .btn-danger').click();await page.locator('.measurement-empty').waitFor();assert.equal((await list(tokenA)).length,0);
  assert.equal((await db.query('SELECT count(*)::int AS count FROM chroniccare.measurements WHERE patient_id=(SELECT id FROM chroniccare.users WHERE email=$1)',[emails[1]])).rows[0].count,1);
  stage='expiration';await db.query("UPDATE chroniccare.sessions SET expires_at=now()-interval '1 second' WHERE user_id=(SELECT id FROM chroniccare.users WHERE email=$1)",[emails[0]]);
  await page.evaluate(async()=>{const{queryClient}=await import('/src/lib/query/queryClient.ts');await queryClient.invalidateQueries({queryKey:['patient','measurements']});});await page.waitForURL('**/login?returnTo=*');await page.locator('.auth-card').waitFor();assert.equal(await page.evaluate(async()=>{const{queryClient}=await import('/src/lib/query/queryClient.ts');return queryClient.getQueryCache().getAll().length;}),0,'Expired sessions must clear protected React Query data');
  await context.close();assert.deepEqual(report.errors,[]);
  report.checks.push('real registration/login/me with PostgreSQL and HttpOnly session','HTTP health and database readiness','rapid inline form submits create one durable measurement with text confirmation','durable create/edit and UTC timestamp preservation','local date grouping with newest reading first','filtered-out mobile save preserves the filter and offers the saved day','Arabic date, value and unit fit at 320px and 200% text in both themes','trend disclosure opens on demand','dashboard pressure link opens and focuses the inline form at desktop and mobile widths','saved pressure value and timestamp refresh on return to dashboard','dashboard has both latest values, units and times in Arabic at desktop and mobile widths in both themes','dashboard/report synchronization','7-day and 90-day report periods recalculate real measurements','logout revocation and login persistence','logout and expiration clear protected React Query data','two-patient isolation on GET/PUT/DELETE','all four widths, AR/EN, light/dark and system OS preferences','failed writes keep form open and never report success','failed reads show errors without demo fallback; retry recovers','authentication-only patient routes','glucose creation and measurement deletion remain isolated','tokens are not persisted to browser storage');
  console.log(JSON.stringify({status:'PASS',checks:report.checks.length,screenshots:report.screenshots.length,output}));
}catch(error){
  report.failureStage=stage;
  const detail=error.name==='TimeoutError' ? ` ${error.message.split('\n')[0]}` : '';
  report.errors.push(error.code==='ERR_ASSERTION'?error.message:`Integration verification failed (${error.name}).${detail}`);
  console.error(report.errors.at(-1));
  process.exitCode=1;
}
finally{
  if(browser)await browser.close();for(const service of services.reverse()){service.child.kill();await service.stopped;}
  try{await db.query('DELETE FROM chroniccare.measurements WHERE patient_id IN(SELECT id FROM chroniccare.users WHERE email=ANY($1::text[]))',[emails]);await db.query('DELETE FROM chroniccare.users WHERE email=ANY($1::text[])',[emails]);}finally{await db.end();}
  await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));
}
