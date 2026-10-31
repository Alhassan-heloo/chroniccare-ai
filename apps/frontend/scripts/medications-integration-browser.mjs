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
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright'),{Client}=backendRequire('pg');
const env=parseEnv(await readFile(resolve(backend,'.env'),'utf8')),databaseUrl=process.env.TEST_DATABASE_URL||env.TEST_DATABASE_URL;
assert(databaseUrl&&new URL(databaseUrl).pathname.endsWith('_test'),'A dedicated test database is required');
const application=new URL(process.env.DATABASE_URL||env.DATABASE_URL),target=new URL(databaseUrl);
assert(application.host!==target.host||application.pathname!==target.pathname,'Application and test databases must differ');
const db=new Client({connectionString:databaseUrl,connectionTimeoutMillis:5000});
const base='http://127.0.0.1:5189',api='http://127.0.0.1:3311/api',output=resolve(root,'artifacts/medications-integration');
await mkdir(output,{recursive:true});
const report={checks:[],screenshots:[],errors:[],expectedFailures:[],http:[],serviceLogs:[]};
const emails=[`${randomUUID()}@browser-medications.example.test`,`${randomUUID()}@browser-medications.example.test`],password=randomBytes(24).toString('hex');
const loginQueues=[[],[]],auditTokens=[],services=[];
const local=new Date(),today=`${local.getFullYear()}-${String(local.getMonth()+1).padStart(2,'0')}-${String(local.getDate()).padStart(2,'0')}`;
let browser,stage='setup',fault=false;
async function start(args,cwd,environment,port){
  const probe=createServer();await new Promise((yes,no)=>{probe.once('error',no);probe.listen(port,'127.0.0.1',yes);});await new Promise(yes=>probe.close(yes));
  const child=spawn(process.execPath,args,{cwd,env:{...process.env,...environment},stdio:['ignore','pipe','pipe']});services.push({child,stopped:once(child,'exit')});
  for(const [stream,label] of [[child.stdout,'stdout'],[child.stderr,'stderr']])stream.on('data',chunk=>{if(report.serviceLogs.length<40)report.serviceLogs.push({port,label,message:String(chunk).replace(/postgres(?:ql)?:\/\/\S+/gi,'[database-url]').slice(0,500)});});
  for(let i=0;i<120;i++){try{await fetch(`http://127.0.0.1:${port}`);return;}catch{/* Startup only. */}await new Promise(yes=>setTimeout(yes,250));}throw Error('Test service did not start');
}
async function navigate(page,path){await page.evaluate(async path=>{const{router}=await import('/src/app/router.tsx');await router.navigate(path);},path);await page.waitForURL(`${base}${path}`);await page.locator('h1').waitFor();}
async function login(page,email){await page.locator('input[type=email]').fill(email);await page.locator('input[autocomplete=current-password]').fill(password);const response=page.waitForResponse(r=>r.url()===`${api}/auth/login`&&r.status()===200);await page.locator('.auth-card button[type=submit]').click();const session=await(await response).json();await page.waitForURL(url=>url.origin===base&&url.pathname.startsWith('/patient/'));return session.token;}
async function logout(page){await page.locator('.session-bar button').click();await page.waitForURL('**/login?returnTo=*');}
async function list(token,date=today){const response=await fetch(`${api}/medications?date=${date}`,{headers:{Authorization:`Bearer ${token}`}});assert.equal(response.status,200);return(await response.json()).medications;}
async function save(page){await page.locator('dialog[open] button[type=submit]').click();await page.locator('dialog[open]').waitFor({state:'hidden'});}
async function shot(page,name){await page.evaluate(()=>document.fonts.ready);await page.mouse.move(0,0);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');const path=resolve(output,`${name}.png`);await page.screenshot({path,fullPage:true});report.screenshots.push(path);}
try{
  await db.connect();
  const migrate=spawn(process.execPath,['dist/db/migrate.js'],{cwd:backend,env:{...process.env,...env,NODE_ENV:'test',DATABASE_URL:databaseUrl},stdio:'ignore'});const[migrationCode]=await once(migrate,'exit');assert.equal(migrationCode,0);
  await start(['dist/server.js'],backend,{...env,NODE_ENV:'test',DATABASE_URL:databaseUrl,HOST:'127.0.0.1',PORT:'3311',CORS_ORIGINS:base},3311);
  assert.equal((await fetch(`${api}/health`)).status,200);assert.equal((await fetch(`${api}/health/ready`)).status,200);
  for(let index=0;index<2;index++){
    const registered=await fetch(`${api}/auth/register`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:`Medication Patient ${index?'B':'A'}`,email:emails[index],password})});assert.equal(registered.status,201);
    for(let attempt=0;attempt<(index?2:3);attempt++){const logged=await fetch(`${api}/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:emails[index],password})});assert.equal(logged.status,200);const session=await logged.json();if(index===1&&attempt===1)auditTokens[index]=session.token;else loginQueues[index].push(session);}
  }
  await start(['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5189','--strictPort'],root,{VITE_API_URL:api},5189);
  browser=await chromium.launch({channel:'msedge',headless:true});report.browser=browser.version();
  const context=await browser.newContext({viewport:{width:1440,height:960},reducedMotion:'no-preference'});
  await context.addInitScript(()=>{localStorage.setItem('cc-language','en');localStorage.setItem('cc-theme','dark');localStorage.setItem('cc-public-motion','paused');});
  await context.route(`${api}/auth/login`,async route=>{const body=route.request().postDataJSON(),index=emails.indexOf(body.email),session=index>=0?loginQueues[index].shift():undefined;assert(session);await route.fulfill({status:200,json:session});});
  const page=await context.newPage();page.setDefaultTimeout(90000);
  page.on('pageerror',error=>report.errors.push(error.message));
  page.on('console',message=>{if(['error','warning'].includes(message.type())){if(/Failed to load resource.*(401|503)/.test(message.text())&&fault)report.expectedFailures.push({stage,message:message.text()});else report.errors.push(message.text());}});
  page.on('response',response=>{if(response.url().startsWith(`${api}/medications`))report.http.push({stage,method:response.request().method(),status:response.status()});});
  stage='patient-A-login';await page.goto(`${base}/login`);let tokenA=await login(page,emails[0]);await navigate(page,'/patient/medications');await page.locator('.measurement-empty').waitFor();assert.equal((await list(tokenA)).length,0);
  stage='failed-create';await page.locator('.medications-actions > button').click();await page.locator('input[name=name]').fill('Integration medicine');await page.locator('input[name=dosage]').fill('As prescribed');await page.locator('.dose-input-row input').fill('08:00');await page.locator('.dose-fieldset > button').click();await page.locator('.dose-input-row input').last().fill('20:00');
  fault=true;await page.route(`${api}/medications?*`,route=>route.request().method()==='POST'?route.fulfill({status:503,json:{error:{code:'TEST_UNAVAILABLE'}}}):route.continue());const failed=page.waitForResponse(r=>r.url().startsWith(`${api}/medications?`)&&r.request().method()==='POST'&&r.status()===503);await page.locator('dialog[open] button[type=submit]').click();await failed;await page.locator('[data-sonner-toast][data-type=error]').first().waitFor();assert(await page.locator('dialog[open]').isVisible());assert.equal((await list(tokenA)).length,0);await page.unroute(`${api}/medications?*`);fault=false;
  stage='create';await page.evaluate(()=>{const button=document.querySelector('dialog[open] button[type=submit]');button.click();button.click();button.click();});await page.locator('dialog[open]').waitFor({state:'hidden'});await page.waitForFunction(()=>document.querySelectorAll('.medication-schedule').length===1);let items=await list(tokenA),id=items[0].id;assert.equal(items.length,1);assert.deepEqual(items[0].doses.map(d=>d.time),['08:00','20:00']);assert.equal((await db.query('SELECT count(*)::int AS count FROM chroniccare.medication_schedules WHERE medication_id=$1',[id])).rows[0].count,2);
  stage='dose';const morning=page.locator('.dose-list li').filter({hasText:'08:00'}).locator('button');await morning.click();await page.waitForFunction(()=>document.querySelector('.medication-summary progress')?.value===1);items=await list(tokenA);assert.equal(items[0].doses[0].takenOn,today);
  stage='edit';await page.locator('.medication-card-actions button').first().click();await page.locator('input[name=dosage]').fill('Updated prescribed information');await page.locator('.dose-input-row input').last().fill('21:00');await save(page);await page.waitForFunction(()=>document.querySelector('.medication-schedule')?.textContent.includes('21:00'));items=await list(tokenA);assert.equal(items[0].doses[0].takenOn,today);assert.equal(items[0].doses[1].takenOn,null);
  await navigate(page,'/patient/dashboard');await page.waitForFunction(()=>document.querySelector('.dashboard-routine-progress strong')?.textContent.trim()==='1/2');await navigate(page,'/patient/reports');await page.waitForFunction(()=>document.querySelector('[data-kind=medication] strong')?.textContent.replace(/\s/g,'')==='1/2');
  stage='logout-login';await logout(page);tokenA=await login(page,emails[0]);assert.equal((await list(tokenA))[0].id,id);await navigate(page,'/patient/medications');await page.locator('.medication-schedule').waitFor();
  stage='responsive';for(const width of[1440,768,390,320]){await page.setViewportSize({width,height:width===1440?960:844});for(const language of['ar','en']){if(await page.locator('html').getAttribute('lang')!==language){await page.locator('.language-toggle').click();await page.waitForFunction(language=>document.documentElement.lang===language,language);}for(const theme of['light','dark']){await page.locator('.theme-select').selectOption(theme);await shot(page,`real-medications-${width}-${language}-${theme}`);assert.equal((await list(tokenA)).length,1);}}}
  await page.setViewportSize({width:1440,height:960});await page.emulateMedia({reducedMotion:'no-preference'});if(await page.locator('.motion-toggle').isDisabled())throw Error('Motion control unexpectedly disabled');assert.equal(await page.locator('.living-medications').getAttribute('data-motion'),'paused');await page.locator('.motion-toggle').click();assert.equal(await page.locator('.living-medications').getAttribute('data-motion'),'running');await page.locator('.motion-toggle').click();assert.equal(await page.locator('.living-medications').getAttribute('data-motion'),'paused');await page.locator('.motion-toggle').click();await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('.living-medications')?.dataset.motion==='paused');assert(await page.locator('.motion-toggle').isDisabled());await page.locator('.theme-select').selectOption('system');for(const os of['dark','light']){await page.emulateMedia({colorScheme:os});await page.waitForFunction(os=>document.documentElement.dataset.theme===os,os);}
  stage='patient-B-isolation';await logout(page);await navigate(page,'/login');await login(page,emails[1]);const tokenB=auditTokens[1];assert(tokenB);await navigate(page,'/patient/medications');await page.locator('.measurement-empty').waitFor();assert.equal((await list(tokenB)).length,0);
  for(const method of['GET','PUT','DELETE']){const response=await fetch(`${api}/medications/${id}${method==='DELETE'?'':`?date=${today}`}`,{method,headers:{Authorization:`Bearer ${tokenB}`,...method==='PUT'?{'Content-Type':'application/json'}:{}},...method==='PUT'?{body:JSON.stringify({name:'Blocked',dosage:'x',notes:'',doses:[{time:'08:00'}]})}:{}});assert.equal(response.status,404);}assert.equal((await fetch(`${api}/medications/${id}/doses/08%3A00`,{method:'PUT',headers:{Authorization:`Bearer ${tokenB}`,'Content-Type':'application/json'},body:JSON.stringify({date:today,taken:true})})).status,404);
  stage='authentication-only';await logout(page);assert.equal(await page.locator('.auth-demo-intro').count(),0);await page.goto(base+'/patient/medications');await page.waitForURL('**/login?returnTo=*');tokenA=await login(page,emails[0]);await navigate(page,'/patient/medications');await page.locator('.medication-schedule').waitFor();assert.equal((await list(tokenA)).length,1);
  stage='read-failure';fault=true;await page.route(`${api}/medications?*`,route=>route.request().method()==='GET'?route.fulfill({status:503,json:{error:{code:'TEST_UNAVAILABLE'}}}):route.continue());await page.evaluate(async()=>{const{queryClient}=await import('/src/lib/query/queryClient.ts');await queryClient.invalidateQueries({queryKey:['patient','medications']});});await page.locator('.medications-page [role=alert]').waitFor();assert.equal(await page.locator('.medication-schedule').count(),0);await page.unroute(`${api}/medications?*`);fault=false;await page.locator('.medications-page [role=alert] button').click();await page.locator('.medication-schedule').waitFor();
  stage='delete';await page.locator('.medication-card-actions button').last().click();await page.locator('dialog[open] .btn-danger').click();await page.locator('.measurement-empty').waitFor();assert.equal((await list(tokenA)).length,0);assert.equal((await list(tokenB)).length,0);
  await context.close();assert.deepEqual(report.errors,[]);
  report.checks=['real registration and PostgreSQL sessions','rapid form submits create one durable medication','durable medication CRUD','multiple schedules and database ownership','daily dose logging and undo contract','schedule edit preserves unchanged dose state','dashboard and reports synchronization','logout/login persistence','two-patient isolation','authentication-only patient routes','failed writes never report success','failed reads never fall back to demo','responsive RTL/LTR themes and motion preferences'];
  console.log(JSON.stringify({status:'PASS',checks:report.checks.length,screenshots:report.screenshots.length,output}));
}catch(error){report.failureStage=stage;report.errors.push(error.code==='ERR_ASSERTION'?error.message:`Integration verification failed (${error.name}); no credentials logged.`);console.error(report.errors.at(-1));process.exitCode=1;}
finally{if(browser)await browser.close();for(const service of services.reverse()){service.child.kill();await service.stopped;}try{await db.query('DELETE FROM chroniccare.medications WHERE patient_id IN(SELECT id FROM chroniccare.users WHERE email=ANY($1::text[]))',[emails]);await db.query('DELETE FROM chroniccare.users WHERE email=ANY($1::text[])',[emails]);}finally{await db.end();}await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));}
