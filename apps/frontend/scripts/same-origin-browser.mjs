// Real built UI + Express + fresh owned PostgreSQL, behind a local TLS ingress.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {randomBytes,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename,dirname,join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createServer as createHttpsServer} from 'node:https';
import {request as httpRequest} from 'node:http';
import {checkPwaFiles,checkPwaStates,readChromiumInstallability} from './pwa-browser-checks.mjs';

const root=resolve(import.meta.dirname,'..'),backend=resolve(root,'../backend'),output=resolve(root,'artifacts/same-origin');
await mkdir(output,{recursive:true});
const database=new URL(process.env.TEST_DATABASE_URL||'http://unconfigured');
assert(['127.0.0.1','localhost','[::1]'].includes(database.hostname)&&/^\/chroniccare_graduation_run_\d+_test$/.test(database.pathname)&&!database.search,'Use final-postgres.mjs with a new owned test database.');
const load=file=>import(pathToFileURL(resolve(backend,'dist',file+'.js')).href);
const {createApp}=await load('app'),{frontendBuildDirectory}=await load('frontend');
const {readEnvironment}=await load('config/env'),{readTrustedProxy}=await load('config/proxy');
const {createDatabasePool,checkDatabase}=await load('db/pool'),{applyMigrations}=await load('db/migrations');
const {hashPassword}=await load('auth/security');
const pool=createDatabasePool(readEnvironment({NODE_ENV:'test',DATABASE_URL:database.href}));
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const privateDirectory=await mkdtemp(join(tmpdir(),'chroniccare-same-origin-tls-'));
const password=randomBytes(24).toString('hex'),email=randomUUID()+'@same-origin.example.test';
const report={mode:'Real production Vite build and Express; fresh isolated PostgreSQL; local TLS ingress with production Secure cookies. Self-signed TLS is accepted only by this test browser.',checks:[],screenshots:[],errors:[],cspViolations:[]};
let browser,server,ingress,backendPort;
const check=message=>report.checks.push(message);
const stop=async server=>{if(server)await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});};
try{
 assert.equal((await pool.query("SELECT to_regnamespace('chroniccare') IS NOT NULL AS present")).rows[0].present,false,'Existing schemas are preserved; this rehearsal requires a fresh database.');
 await applyMigrations(pool);
 const stores={};
 for(const [key,path,factory] of [
  ['authStore','auth/store','postgresAuthStore'],['measurementStore','measurements/store','postgresMeasurementStore'],
  ['medicationStore','medications/store','postgresMedicationStore'],['habitStore','habits/store','postgresHabitStore'],
  ['doctorStore','doctor/store','postgresDoctorStore'],['adminStore','admin/store','postgresAdminStore'],
  ['connectionStore','connections/store','postgresConnectionStore'],['notificationStore','notifications/store','postgresNotificationStore'],
  ['registrationStore','notifications/registrations','postgresRegistrationStore'],
 ])stores[key]=(await load(path))[factory](pool);
 const patient=await stores.authStore.createUser('مريض اختبار النشر',email,await hashPassword(password),'patient');
 const recordedAt=new Date().toISOString();await stores.measurementStore.create(patient.id,{input:{kind:'bloodPressure',systolic:128,diastolic:82},recordedAt});
 const cert=join(privateDirectory,'cert.pem'),key=join(privateDirectory,'key.pem');
 const generated=spawnSync(process.env.OPENSSL_BINARY||'openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1'],{windowsHide:true,stdio:'ignore'});
 assert.equal(generated.status,0,'Generate a test-only TLS certificate with the existing OpenSSL binary.');
 ingress=createHttpsServer({key:await readFile(key),cert:await readFile(cert)},(request,response)=>{
  const upstream=httpRequest({host:'127.0.0.1',port:backendPort,path:request.url,method:request.method,
   headers:{...request.headers,'x-forwarded-proto':'https','x-forwarded-for':request.socket.remoteAddress,'x-forwarded-host':request.headers.host}},incoming=>{response.writeHead(incoming.statusCode,incoming.headers);incoming.pipe(response);});
  upstream.on('error',()=>{response.writeHead(502);response.end();});request.pipe(upstream);
 });
 ingress.listen(0,'127.0.0.1');await once(ingress,'listening');const origin='https://127.0.0.1:'+ingress.address().port;
 const app=createApp({corsOrigins:[origin],checkDatabase:()=>checkDatabase(pool),...stores,frontendDirectory:frontendBuildDirectory,
  cookies:{secure:true,trustedProxy:readTrustedProxy({TRUST_RENDER_PROXY:'true',RENDER:'true',RENDER_SERVICE_TYPE:'web'})}});
 server=app.listen(0,'127.0.0.1');await once(server,'listening');backendPort=server.address().port;
 assert.equal((await fetch('http://127.0.0.1:'+backendPort+'/api/health/ready')).status,200);
 assert.equal((await fetch('http://127.0.0.1:'+backendPort+'/login')).status,400);
 check('Internal HTTP readiness200 and production HTTPS requirement on HTML remain intact');
 browser=await chromium.launch({channel:'msedge',headless:true});
 const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:900},reducedMotion:'reduce'});
 await context.addInitScript(()=>{localStorage.setItem('cc-language','ar');localStorage.setItem('cc-theme','dark');document.addEventListener('securitypolicyviolation',event=>void window.recordCSPViolation({directive:event.violatedDirective,blockedURI:event.blockedURI,source:event.sourceFile,line:event.lineNumber,sample:event.sample}));});
 const page=await context.newPage();const apiRequests=[];
 await page.exposeFunction('recordCSPViolation',details=>{report.cspViolations.push(details);});
 page.on('pageerror',error=>report.errors.push(error.message.replaceAll(password,'[redacted]')));
 page.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/api/'))apiRequests.push(request.url());});
 await page.goto(origin,{waitUntil:'domcontentloaded'});await page.locator('.hy-brand').first().waitFor();
 assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
 const html=await (await context.request.get(origin)).text();assert(!html.includes('/src/main.tsx'));assert.equal(await page.locator('script:not([src])').count(),0,'No inline executable bootstrap under Helmet CSP');
 check('Express serves the actual Vite output, homepage assets and unchanged pre-React locale/theme under CSP');
 await checkPwaFiles(page,origin,frontendBuildDirectory);
 check('Express serves real manifest and192/512/180px PNG files with correct MIME types, and Chromium parses the manifest');
 await page.goto(origin+'/patient/dashboard',{waitUntil:'domcontentloaded'});await page.locator('.auth-card').waitFor();
 await page.locator('input[type=email]').fill(email);await page.locator('input[autocomplete=current-password]').fill(password);await page.locator('.auth-card form button[type=submit]').click();
 await page.waitForURL(url=>url.pathname==='/patient/dashboard',{waitUntil:'domcontentloaded'});await page.locator('.metric-number').first().filter({hasText:'128/82'}).waitFor();
 const cookies=await context.cookies(origin);const session=cookies.find(cookie=>cookie.name==='__Host-cc_session');
 assert(session?.secure&&session.httpOnly&&session.sameSite==='Lax'&&session.path==='/');
 report.cookieFlags={name:session.name,secure:session.secure,httpOnly:session.httpOnly,sameSite:session.sameSite,path:session.path};
 check('Real same-origin browser login uses CSRF and a Secure HttpOnly SameSite=Lax host session cookie');
 await page.reload({waitUntil:'domcontentloaded'});await page.locator('.metric-number').first().filter({hasText:'128/82'}).waitFor();
 assert.equal(await page.locator('.metric-time').first().getAttribute('datetime'),recordedAt);await page.locator('.chart-loading').waitFor({state:'hidden'});
 const shot=resolve(output,'patient-dashboard-refreshed.png');await page.screenshot({path:shot,fullPage:true});report.screenshots.push(shot);
 check('Patient dashboard refresh preserves the real session, measurement value and stored timestamp');
 await page.locator('.header-preferences-button').click();
 const installSettings=page.locator('dialog[open] .phone-install');
 assert.equal(await installSettings.locator('summary').innerText(),'ثبّت التطبيق على هاتفك');
 await installSettings.locator('summary').click();
 await installSettings.getByText('يحتاج التطبيق إلى اتصال بالإنترنت.').waitFor();
 await page.keyboard.press('Escape');
 check('The patient settings expose the Arabic install action and online requirement');
 await page.goto(origin+'/patient/measurements',{waitUntil:'domcontentloaded'});await page.locator('.measurement-entry').waitFor();await page.reload({waitUntil:'domcontentloaded'});await page.locator('.measurement-entry').waitFor();
 check('Direct deep links and refreshes load the built React shell and authorized data');
 for(const path of ['/api/unknown','/api/index.html','/assets/missing.js','/src/main.tsx','/.env','/artifacts/private']){const response=await context.request.get(origin+path,{headers:{Accept:'text/html'}});assert.equal(response.status(),404,path);assert.equal((await response.json()).error.code,'NOT_FOUND');}
 assert.equal((await context.request.get(origin+'/api/health/ready')).status(),200);
 assert.equal((await context.request.get(origin+'/cc-fcm/sw.js')).status(),200);
 check('API JSON404s, missing assets and blocked source/private paths remain distinct; readiness and push worker stay available');
 assert.equal((await context.request.post(origin+'/api/auth/logout',{headers:{Origin:origin}})).status(),403);
 assert.equal((await context.request.get(origin+'/api/auth/me',{headers:{Origin:'https://untrusted.example'}})).status(),403);
 assert.equal((await context.request.get(origin+'/api/admin/doctors')).status(),403);
 assert.equal((await context.request.get(origin+'/api/doctor/patients')).status(),403);
 await page.goto(origin+'/doctor/dashboard',{waitUntil:'domcontentloaded'});await page.waitForURL(url=>url.pathname==='/patient/dashboard',{waitUntil:'domcontentloaded'});
 check('Missing CSRF, untrusted origins and wrong-role API/UI access remain rejected');
 assert(apiRequests.length>0&&apiRequests.every(url=>new URL(url).origin===origin),'Every browser API request uses its own HTTPS origin');
 await checkPwaStates(browser,origin,check,report);
 report.chromiumInstallability=await readChromiumInstallability(chromium,join(privateDirectory,'profile'),origin);
 assert.deepEqual(report.chromiumInstallability.errors,[],'Chromium normal-profile installability');
 check('Chromium normal profile reports no installability errors');
 assert.deepEqual(report.cspViolations,[]);assert.deepEqual(report.errors,[]);
 check('No cross-origin API calls or CSP/runtime violations observed');
 report.status='PASS';console.log(JSON.stringify({status:'PASS',checks:report.checks.length,cookieFlags:report.cookieFlags}));
}catch(error){report.status='FAIL';report.errors.push(String(error.message).replaceAll(password,'[redacted]'));console.error(JSON.stringify({status:'FAIL',error:report.errors.at(-1)}));process.exitCode=1;}
finally{
 if(browser)await browser.close();await stop(ingress);await stop(server);await pool.end();
 assert.equal(dirname(privateDirectory),resolve(tmpdir()));assert(basename(privateDirectory).startsWith('chroniccare-same-origin-tls-'));await rm(privateDirectory,{recursive:true,force:true});
 await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));
}
