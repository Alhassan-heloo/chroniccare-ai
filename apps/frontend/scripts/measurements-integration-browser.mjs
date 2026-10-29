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
const base='http://127.0.0.1:5188',api='http://127.0.0.1:3310/api',output=resolve(root,'artifacts/measurements-integration');
await mkdir(output,{recursive:true});
const report={checks:[],screenshots:[],errors:[],expectedFailures:[],http:[],authHttp:[],serviceLogs:[]};
const emails=[`${randomUUID()}@browser-measurements.example.test`,`${randomUUID()}@browser-measurements.example.test`];
const password=randomBytes(24).toString('hex'),services=[];
const loginQueues=[[],[]],auditTokens=[];
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
  await page.locator('.auth-card button[type=submit]').click();const session=await(await response).json();
  await page.waitForURL(url=>url.origin===base&&url.pathname.startsWith('/patient/'));return session.token;
}
async function logout(page){await page.locator('.session-bar button').click();await page.waitForURL('**/login?returnTo=*');}
async function save(page){await page.locator('dialog[open] button[type=submit]').click();await page.locator('dialog[open]').waitFor({state:'hidden'});}
async function list(token){const response=await fetch(`${api}/measurements`,{headers:{Authorization:`Bearer ${token}`}});assert.equal(response.status,200);return(await response.json()).measurements;}
async function shot(page,name){
  await page.evaluate(()=>document.fonts.ready);await page.mouse.move(0,0);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');
  const path=resolve(output,`${name}.png`);await page.screenshot({path,fullPage:true});report.screenshots.push(path);
}
try{
  await db.connect();
  // Migrations only on the guarded test connection; never change process .env files.
  const migrate=spawn(process.execPath,['--import','tsx','src/db/migrate.ts'],{cwd:backend,env:{...process.env,...env,NODE_ENV:'test',DATABASE_URL:databaseUrl},stdio:'ignore'});
  const [migrationCode]=await once(migrate,'exit');assert.equal(migrationCode,0);
  await start(['dist/server.js'],backend,{...env,NODE_ENV:'test',DATABASE_URL:databaseUrl,HOST:'127.0.0.1',PORT:'3310',CORS_ORIGINS:base},3310);
  assert.equal((await fetch(`${api}/health`)).status,200);assert.equal((await fetch(`${api}/health/ready`)).status,200);
  // Complete real registration/login before launching the resource-heavy browser.
  // The browser consumes these live PostgreSQL sessions; /me, logout and all
  // measurement requests still reach Express directly.
  for(let index=0;index<emails.length;index++){
    const registered=await fetch(`${api}/auth/register`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:`Patient ${index===0?'A':'B'}`,email:emails[index],password})});assert.equal(registered.status,201);
    const count=index===0?3:2;
    for(let attempt=0;attempt<count;attempt++){const logged=await fetch(`${api}/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:emails[index],password})});assert.equal(logged.status,200);const session=await logged.json();if(index===1&&attempt===1)auditTokens[index]=session.token;else loginQueues[index].push(session);}
  }
  await start(['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5188','--strictPort'],root,{VITE_API_URL:api},5188);
  browser=await chromium.launch({channel:'msedge',headless:true});report.browser=browser.version();
  const context=await browser.newContext({viewport:{width:1440,height:960},reducedMotion:'reduce'});
  await context.addInitScript(()=>{localStorage.setItem('cc-language','en');localStorage.setItem('cc-theme','dark');});
  await context.route(`${api}/auth/login`,async route=>{const body=route.request().postDataJSON();const index=emails.indexOf(body.email);const session=index>=0?loginQueues[index].shift():undefined;assert(session,'A prepared real login session is required');await route.fulfill({status:200,json:session});});
  const page=await context.newPage();
  // Password hashing can be slower while Edge, Vite and PostgreSQL share a
  // resource-constrained development machine; functional waits remain bounded.
  page.setDefaultTimeout(90000);
  page.on('pageerror',error=>report.errors.push(error.message));
  page.on('console',message=>{if(['error','warning'].includes(message.type())){if(/Failed to load resource.*(401|503)/.test(message.text())&&(fault||stage==='expiration'))report.expectedFailures.push({stage,message:message.text()});else report.errors.push(message.text());}});
  page.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/api/auth/')){let shape;try{const body=request.postDataJSON();shape=body&&typeof body==='object'?{keys:Object.keys(body).sort(),nameLength:String(body.name??'').length,emailLength:String(body.email??'').length,passwordLength:String(body.password??'').length}:undefined;}catch{/* No JSON body. */}report.authHttp.push({stage,method:request.method(),url:new URL(request.url()).origin+new URL(request.url()).pathname,...shape?{shape}:{}});}});
  page.on('response',response=>{if(response.url().startsWith(`${api}/measurements`))report.http.push({stage,method:response.request().method(),status:response.status()});});
  stage='patient-A-login';await page.goto(`${base}/login`);let tokenA=await login(page,emails[0]);
  assert(await page.evaluate(token=>![...Object.values(localStorage),...Object.values(sessionStorage)].includes(token),tokenA),'Bearer token stays in memory');
  await navigate(page,'/patient/measurements');await page.locator('.measurement-empty').waitFor();assert.equal((await list(tokenA)).length,0);
  stage='failed-create';await page.locator('.measurements-actions > button').click();await page.locator('input[name=systolic]').fill('135');await page.locator('input[name=diastolic]').fill('85');
  fault=true;await page.route(`${api}/measurements`,route=>route.request().method()==='POST'?route.fulfill({status:503,json:{error:{code:'TEST_UNAVAILABLE'}}}):route.continue());
  const failed=page.waitForResponse(r=>r.url()===`${api}/measurements`&&r.request().method()==='POST'&&r.status()===503);
  await page.locator('dialog[open] button[type=submit]').click();await failed;await page.locator('[data-sonner-toast][data-type=error]').first().waitFor();
  assert(await page.locator('dialog[open]').isVisible());assert.equal((await list(tokenA)).length,0);assert.equal(await page.locator('.measurement-entry').count(),0);
  await page.unroute(`${api}/measurements`);fault=false;
  stage='create';await save(page);await page.waitForFunction(()=>document.querySelectorAll('.measurement-entry').length===1);
  let readings=await list(tokenA);const id=readings[0].id,timestamp=readings[0].recordedAt;assert.equal(readings[0].isExample,false);
  assert.equal(await page.locator('.measurement-entry time').getAttribute('dateTime'),timestamp);
  const committed=await db.query('SELECT patient_id,recorded_at FROM chroniccare.measurements WHERE id=$1',[id]);assert.equal(committed.rowCount,1);assert.equal(committed.rows[0].recorded_at.toISOString(),timestamp);
  stage='edit';await page.locator('.measurement-entry-actions button').first().click();await page.locator('input[name=systolic]').fill('140');await page.locator('input[name=diastolic]').fill('90');await save(page);
  await page.waitForFunction(()=>document.querySelector('.measurement-entry-value').textContent.includes('140/90'));readings=await list(tokenA);assert.equal(readings[0].recordedAt,timestamp);
  await navigate(page,'/patient/dashboard');await page.waitForFunction(()=>document.querySelector('.metric-number')?.textContent.trim()==='140/90');assert.match(await page.locator('.dashboard-welcome h1').innerText(),/Patient A/);
  await navigate(page,'/patient/reports');await page.locator('.report-readings').filter({hasText:'140/90'}).waitFor();
  stage='logout-login';await logout(page);assert.equal((await fetch(`${api}/measurements`,{headers:{Authorization:`Bearer ${tokenA}`}})).status,401);tokenA=await login(page,emails[0]);
  assert.equal((await list(tokenA))[0].id,id);stage='logout-login-navigation';await navigate(page,'/patient/measurements');stage='logout-login-render';
  await page.locator('.measurement-entry, .measurement-empty, .measurement-results [role=alert]').first().waitFor({timeout:20000});assert.equal(await page.locator('.measurement-entry').count(),1,'The persisted reading must render after logging in again');
  stage='viewport-language-theme';for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:width===1440?960:844});for(const language of ['ar','en']){if(await page.locator('html').getAttribute('lang')!==language){await page.locator('.language-toggle').click();await page.waitForFunction(language=>document.documentElement.lang===language,language);}for(const theme of ['light','dark']){await page.locator('.theme-select').selectOption(theme);await shot(page,`real-measurements-${width}-${language}-${theme}`);assert.equal((await list(tokenA)).length,1);}}}
  await page.setViewportSize({width:1440,height:960});await page.locator('.theme-select').selectOption('system');for(const os of ['dark','light']){await page.emulateMedia({colorScheme:os});await page.waitForFunction(os=>document.documentElement.dataset.theme===os,os);}
  stage='patient-B-isolation';await logout(page);await navigate(page,'/login');await login(page,emails[1]);const tokenB=auditTokens[1];assert(tokenB);await navigate(page,'/patient/measurements');await page.locator('.measurement-empty').waitFor();assert.equal((await list(tokenB)).length,0);
  for(const method of ['GET','PUT','DELETE']){const response=await fetch(`${api}/measurements/${id}`,{method,headers:{Authorization:`Bearer ${tokenB}`,...method==='PUT'?{'Content-Type':'application/json'}:{}},...method==='PUT'?{body:JSON.stringify({kind:'glucose',value:99})}:{}});assert.equal(response.status,404);}
  await page.locator('.measurements-actions > button').click();await page.locator('#reading-kind').selectOption('glucose');await page.locator('input[name=value]').fill('99.25');await save(page);await page.locator('.measurement-entry').waitFor();assert.equal((await list(tokenB)).length,1);
  stage='demo-separation';await logout(page);await page.locator('.auth-card > .btn-secondary').click();await page.waitForURL('**/patient/dashboard');const requestsBeforeDemo=report.http.length;await navigate(page,'/patient/measurements');await page.waitForFunction(()=>document.querySelectorAll('.measurement-entry').length===14);
  await page.locator('.measurements-actions > button').click();await page.locator('input[name=systolic]').fill('125');await page.locator('input[name=diastolic]').fill('85');await save(page);assert.equal(await page.locator('.measurement-entry').count(),15);assert.equal(report.http.length,requestsBeforeDemo,'Demo measurements make no backend calls');
  await logout(page);tokenA=await login(page,emails[0]);await navigate(page,'/patient/measurements');await page.locator('.measurement-entry').waitFor();assert.equal((await list(tokenA)).length,1);assert.equal((await list(tokenB)).length,1);
  stage='read-failure';fault=true;await page.route(`${api}/measurements`,route=>route.fulfill({status:503,json:{error:{code:'TEST_UNAVAILABLE'}}}));await page.evaluate(async()=>{const{queryClient}=await import('/src/lib/query/queryClient.ts');await queryClient.invalidateQueries({queryKey:['patient','measurements']});});
  await page.locator('.measurement-results [role=alert]').waitFor();assert.equal(await page.locator('.measurement-entry').count(),0);await page.unroute(`${api}/measurements`);fault=false;await page.locator('.measurement-results [role=alert] button').click();await page.locator('.measurement-entry').waitFor();
  stage='delete';await page.locator('.measurement-entry-actions button').last().click();await page.locator('dialog[open] .btn-danger').click();await page.locator('.measurement-empty').waitFor();assert.equal((await list(tokenA)).length,0);assert.equal((await list(tokenB)).length,1);
  stage='expiration';await db.query("UPDATE chroniccare.sessions SET expires_at=now()-interval '1 second' WHERE user_id=(SELECT id FROM chroniccare.users WHERE email=$1)",[emails[0]]);
  await page.evaluate(async()=>{const{queryClient}=await import('/src/lib/query/queryClient.ts');await queryClient.invalidateQueries({queryKey:['patient','measurements']});});await page.waitForURL('**/login?returnTo=*');await page.locator('.auth-card').waitFor();
  await context.close();assert.deepEqual(report.errors,[]);
  report.checks=['real registration/login/me with PostgreSQL','HTTP health and database readiness','durable create/edit and UTC timestamp preservation','dashboard/report synchronization','logout revocation and login persistence','two-patient isolation on GET/PUT/DELETE','all four widths, AR/EN, light/dark and system OS preferences','failed writes keep form open and never report success','failed reads show errors without demo fallback; retry recovers','14-row guest demo and guest CRUD stay independent of PostgreSQL','deletion remains isolated; session expiry clears protected access','tokens are not persisted to browser storage'];
  console.log(JSON.stringify({status:'PASS',checks:report.checks.length,screenshots:report.screenshots.length,output}));
}catch(error){report.failureStage=stage;report.errors.push(error.code==='ERR_ASSERTION'?error.message:`Integration verification failed (${error.name}); no credentials logged.`);console.error(report.errors.at(-1));process.exitCode=1;}
finally{
  if(browser)await browser.close();for(const service of services.reverse()){service.child.kill();await service.stopped;}
  try{await db.query('DELETE FROM chroniccare.measurements WHERE patient_id IN(SELECT id FROM chroniccare.users WHERE email=ANY($1::text[]))',[emails]);await db.query('DELETE FROM chroniccare.users WHERE email=ANY($1::text[])',[emails]);}finally{await db.end();}
  await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));
}
