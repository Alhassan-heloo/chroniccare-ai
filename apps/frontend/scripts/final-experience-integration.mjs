// Real Express + isolated PostgreSQL test database. Disposable synthetic accounts only.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { doctorBrowserFixtures, changePreferences } from './doctor-browser-fixtures.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const output=resolve(root,'artifacts/graduation-finalization/real-service');await mkdir(output,{recursive:true});
const password=randomBytes(24).toString('hex');
const emails=Object.fromEntries(['admin','doctor','emailDoctor','patient','other'].map(key=>[key,randomUUID()+'@graduation.example.test']));
const fixtures=await doctorBrowserFixtures({frontendPort:5198,backendPort:3318,emails:Object.values(emails),password});
const {base,api,pool,request}=fixtures;
const report={mode:'Real Express and isolated PostgreSQL; captured email transport only, no real email delivery.',checks:[],screenshots:[],errors:[]};
let browser,recordingSession,stage='setup';const recordingFrames=[];const contexts=[];
const check=(message)=>report.checks.push(message);
const redact=text=>String(text).replace(/[A-Za-z0-9_-]{32,}/g,'[redacted]');
const tokenFrom=link=>new URLSearchParams(new URL(link).hash.slice(1)).get('token');
const hash=token=>createHash('sha256').update(token).digest('hex');
async function context(width=1440,theme='light'){
  const result=await browser.newContext({viewport:{width,height:960},reducedMotion:'reduce'});contexts.push(result);
  await result.addInitScript(({theme})=>{try{if(!localStorage.getItem('cc-language'))localStorage.setItem('cc-language','ar');if(!localStorage.getItem('cc-theme'))localStorage.setItem('cc-theme',theme);localStorage.setItem('cc-public-motion','paused');}catch{/* about:blank has no storage origin. */}},{theme});
  result.on('page',page=>page.on('pageerror',error=>report.errors.push(redact(error.message))));return result;
}
async function signIn(page,email,secret=password){
  await page.locator('input[type=email]').fill(email);await page.locator('input[autocomplete=current-password]').fill(secret);
  const response=page.waitForResponse(res=>res.url()===api+'/auth/login');await page.locator('.auth-card form button[type=submit]').click();assert.equal((await response).status(),200);
}
async function shot(page,name){
  await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(100);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+' fits viewport');
  const path=resolve(output,name+'.png');await page.screenshot({path,fullPage:true,mask:[page.locator('#patient-invitation-link'),page.locator('.temporary-credential input')]});report.screenshots.push(path);
}
async function createLink(page,email){
  await page.goto(base+'/doctor/connect',{waitUntil:"domcontentloaded",timeout:60000});await page.locator('.targeted-invitation-card input[type=email]').fill(email);await page.locator('.targeted-invitation-card form button[type=submit]').click();
  await page.locator('#patient-invitation-link').waitFor();return page.locator('#patient-invitation-link').inputValue();
}
try{
  const adminToken=await fixtures.start(emails.admin);
  browser=await chromium.launch({channel:'msedge',headless:true});
  const adminContext=await context();const adminPage=await adminContext.newPage();
  stage='admin-add-doctor';await adminPage.goto(base+'/login',{waitUntil:"domcontentloaded",timeout:60000});await signIn(adminPage,emails.admin);await adminPage.locator('.admin-open-create').click();
  const dialog=adminPage.getByRole('dialog');await dialog.waitFor();await shot(adminPage,'admin-add-doctor-ar-light-1440');
  await dialog.locator('form button[type=submit]').click();assert.equal(await dialog.locator('[aria-invalid=true]').count(),2);assert(await dialog.locator('input').first().evaluate(el=>el===document.activeElement));
  await dialog.locator('input[autocomplete=name]').fill('د. ليلى محمود');await dialog.locator('input[type=email]').fill(emails.doctor);await dialog.locator('form button[type=submit]').click();
  await dialog.locator('.temporary-credential input').waitFor();const temporary=await dialog.locator('.temporary-credential input').inputValue();
  assert(temporary.length>=32);assert.equal(await dialog.locator('.temporary-credential input').getAttribute('type'),'password');await shot(adminPage,'admin-created-doctor-ar-light-1440');
  await dialog.locator('input[autocomplete=name]').fill('د. ليلى محمود');await dialog.locator('input[type=email]').fill(emails.doctor);await dialog.locator('form button[type=submit]').click();await dialog.getByText('يوجد حساب بهذا البريد الإلكتروني بالفعل.',{exact:true}).waitFor();
  await shot(adminPage,'admin-duplicate-doctor-ar-light-1440');await adminPage.keyboard.press('Escape');
  await adminPage.locator('.admin-open-create').click();await dialog.getByRole('button',{name:'دعوة تفعيل بالبريد',exact:true}).click();await dialog.locator('input[autocomplete=name]').fill('د. هدى سمير');await dialog.locator('input[type=email]').fill(emails.emailDoctor);await dialog.locator('form button[type=submit]').click();await dialog.getByText(/أُرسلت دعوة التفعيل/).waitFor();await shot(adminPage,'admin-email-invitation-ar-light-1440');await adminPage.keyboard.press('Escape');
  await adminPage.locator('.invitation-ledger').waitFor();const pendingRow=adminPage.locator('.invitation-ledger details').filter({hasText:emails.emailDoctor});await pendingRow.getByText('بانتظار التفعيل',{exact:true}).waitFor();await shot(adminPage,'admin-pending-ledger-ar-light-1440');
  const activationLink=fixtures.capturedEmail(emails.emailDoctor)?.split('\n').find(line=>line.startsWith(base+'/activate-doctor#'));assert(activationLink);
  const activationContext=await context(390,'dark');const activationPage=await activationContext.newPage();await activationPage.goto(activationLink,{waitUntil:"domcontentloaded",timeout:60000});await activationPage.locator('input[autocomplete=new-password]').first().fill(password);await activationPage.locator('input[autocomplete=new-password]').nth(1).fill(password);await activationPage.locator('form button[type=submit]').click();await activationPage.getByText(/تم الحفظ بنجاح/).waitFor();await shot(activationPage,'doctor-email-activated-ar-dark-390');await fixtures.login(emails.emailDoctor,'doctor');
  await adminPage.goto(base+'/admin/dashboard',{waitUntil:"domcontentloaded",timeout:60000});await adminPage.locator('.invitation-ledger details').first().waitFor();const invitationRow=adminPage.locator('.invitation-ledger details').filter({hasText:emails.emailDoctor});await invitationRow.locator('summary').click();await invitationRow.getByText('الحساب مفعّل',{exact:true}).waitFor();const ledgerResponse=await request('/admin/invitations',{token:adminToken});const ledger=await ledgerResponse.json();const activated=ledger.invitations.find(item=>item.email===emails.emailDoctor);assert.equal(activated.status,'closed');assert.equal(activated.accountStatus,'active');assert.equal(await invitationRow.locator('.invitation-issued time').getAttribute('datetime'),activated.issuedAt);await shot(adminPage,'admin-activation-ledger-ar-light-1440');check('Admin invitation ledger matches actual issuance, delivery, closed link and active account; no raw activation token exposed');
  check('Email-mode UI acknowledges pending activation; captured delivery link activates in the real mobile form and permits doctor sign-in');
  await adminPage.setViewportSize({width:390,height:844});await changePreferences(adminPage,{theme:'dark'});await adminPage.locator('.admin-open-create').click();await shot(adminPage,'admin-add-doctor-ar-dark-390');await adminPage.keyboard.press('Escape');
  check('Admin-only direct doctor creation, field validation/focus, masked credential, duplicate handling, Arabic desktop/mobile themes');

  stage='doctor-temporary-password';const doctorContext=await context();const doctorPage=await doctorContext.newPage();await doctorPage.goto(base+'/login',{waitUntil:"domcontentloaded",timeout:60000});await signIn(doctorPage,emails.doctor,temporary);
  await doctorPage.locator('input[autocomplete=new-password]').first().waitFor();await doctorPage.locator('input[autocomplete=current-password]').fill(temporary);await doctorPage.locator('input[autocomplete=new-password]').nth(0).fill(password);await doctorPage.locator('input[autocomplete=new-password]').nth(1).fill(password);await doctorPage.locator('main form button[type=submit]').click();
  await doctorPage.locator('.auth-card').waitFor();await signIn(doctorPage,emails.doctor);await doctorPage.locator('.doctor-review-workspace').waitFor();check('Real temporary-password first login forces change, revokes session, and permits fresh doctor sign-in');
  for(const [key,name] of [['patient','سارة أحمد'],['other','عمر خالد']]){
    assert.equal((await request('/auth/register',{body:{name,email:emails[key],password}})).status,201);
  }
  const dt=await fixtures.login(emails.doctor,'doctor'),pt=await fixtures.login(emails.patient,'patient'),ot=await fixtures.login(emails.other,'patient');
  const users=await pool.query('SELECT id,email FROM chroniccare.users WHERE email=ANY($1::text[])',[Object.values(emails)]);const id=key=>users.rows.find(row=>row.email===emails[key]).id;
  for(const [token,systolic,diastolic,value] of [[pt,124,79,102],[ot,137,86,116]]){
    assert.equal((await request('/measurements',{token,body:{kind:'bloodPressure',systolic,diastolic,recordedAt:new Date().toISOString()}})).status,201);
    assert.equal((await request('/measurements',{token,body:{kind:'glucose',value,recordedAt:new Date(Date.now()-86400000).toISOString()}})).status,201);
  }
  const day=new Date().toLocaleDateString('en-CA');
  assert.equal((await request('/medications?date='+day,{token:pt,body:{name:'دواء توضيحي',dosage:'10 mg',notes:'',doses:[{time:'20:00'}]}})).status,201);
  assert.equal((await request('/habits?date='+day,{token:pt,body:{title:'المشي اليومي',unit:'minutes',target:30}})).status,201);
  const habitList=await (await request('/habits?date='+day,{token:pt})).json();assert.equal((await request('/habits/'+habitList.habits[0].id+'/progress',{token:pt,method:'PUT',body:{date:day,value:15}})).status,204);
  const record=()=>request(`/doctor/patients/${id('patient')}?date=${day}`,{token:dt});
  stage='doctor-invites';let link=await createLink(doctorPage,emails.patient);let token=tokenFrom(link);assert.equal((await record()).status,404);await shot(doctorPage,'doctor-invitation-issued-ar-light-1440');
  await doctorPage.context().grantPermissions(['clipboard-read','clipboard-write'],{origin:base});await doctorPage.getByRole('button',{name:'نسخ الرابط',exact:true}).click();assert.equal(await doctorPage.evaluate(()=>navigator.clipboard.readText()),link);check('Doctor enters intended account email and copies a ten-minute, single-use opaque link');
  const patientContext=await context(390,'light');const patientPage=await patientContext.newPage();recordingSession=await patientContext.newCDPSession(patientPage);let lastFrame=0;recordingSession.on('Page.screencastFrame',event=>{const now=Date.now();if(now-lastFrame>=120&&recordingFrames.length<250){recordingFrames.push({data:event.data,time:now});lastFrame=now;}void recordingSession.send('Page.screencastFrameAck',{sessionId:event.sessionId}).catch(()=>{});});await recordingSession.send('Page.startScreencast',{format:'jpeg',quality:65,maxWidth:390,maxHeight:960,everyNthFrame:2});
  stage='mobile-signin-return';await patientPage.goto(link,{waitUntil:"domcontentloaded",timeout:60000});await patientPage.locator('.invitation-sign-in').waitFor();await shot(patientPage,'invitation-sign-in-ar-light-390');await patientPage.locator('.invitation-sign-in').click();
  const loginUrl=new URL(patientPage.url());assert.equal(loginUrl.pathname,'/login');assert(!loginUrl.search.includes(token));assert(loginUrl.hash.includes(token));await signIn(patientPage,emails.patient);await patientPage.locator('.invitation-consent').waitFor();assert.equal(new URL(patientPage.url()).pathname,'/patient/invitation');
  await shot(patientPage,'invitation-review-ar-light-390');assert.equal((await record()).status,404);
  await patientPage.getByRole('button',{name:'إغلاق المراجعة',exact:true}).click();await patientPage.getByText(/أُغلقت المراجعة/).waitFor();
  assert.equal((await request('/connections/invitations/preview',{token:pt,body:{token}})).status,200);
  assert.equal((await record()).status,404);await shot(patientPage,'invitation-closed-ar-light-390');
  check('Mobile sign-in returns with the fragment token; closing review leaves that exact invitation available');

  stage='permanent-rejection';
  await patientPage.reload({waitUntil:'domcontentloaded'});
  const rejectButton=patientPage.getByRole('button',{name:'رفض الدعوة',exact:true});
  await rejectButton.focus();
  await patientPage.keyboard.press('Enter');
  const rejectionDialog=patientPage.getByRole('dialog',{name:'رفض الدعوة'});
  await rejectionDialog.waitFor();
  assert(await rejectionDialog.evaluate(element=>element.contains(document.activeElement)));
  assert.equal(await rejectionDialog.getByRole('button',{name:'رفض الدعوة',exact:true}).evaluate(element=>element===document.activeElement),false);
  await shot(patientPage,'invitation-reject-dialog-ar-light-390');
  await patientPage.keyboard.press('Escape');
  await rejectionDialog.waitFor({state:'hidden'});
  assert(await rejectButton.evaluate(element=>element===document.activeElement));
  assert.equal((await request('/connections/invitations/preview',{token:pt,body:{token}})).status,200);
  await patientPage.keyboard.press('Enter');
  const confirmRejection=rejectionDialog.getByRole('button',{name:'رفض الدعوة',exact:true});
  const rejectEndpoint=api+'/connections/invitations/reject';
  await patientPage.route(rejectEndpoint,route=>route.fulfill({status:503,json:{error:{code:'TEST_UNAVAILABLE'}}}),{times:1});
  await confirmRejection.click();
  await rejectionDialog.getByRole('alert').getByText(/تعذّر تأكيد رفض الدعوة/).waitFor();
  assert.equal((await request('/connections/invitations/preview',{token:pt,body:{token}})).status,200);
  await confirmRejection.focus();
  await patientPage.keyboard.press('Enter');
  const rejectionStatus=patientPage.getByRole('main').getByRole('status').getByText(/رُفضت الدعوة نهائيًا/);
  await rejectionStatus.waitFor();
  await rejectionDialog.waitFor({state:'hidden'});
  assert(await rejectionStatus.evaluate(element=>document.activeElement?.contains(element)));
  assert.equal((await record()).status,404);
  assert.equal((await request('/connections/invitations/approve',{token:pt,body:{token}})).status,409);
  await shot(patientPage,'invitation-rejected-ar-light-390');
  await patientPage.setViewportSize({width:320,height:740});
  await changePreferences(patientPage,{language:'en',theme:'dark'});
  await patientPage.reload({waitUntil:'domcontentloaded'});
  await patientPage.getByRole('main').getByRole('alert').getByText(/Invitation permanently rejected/).waitFor();
  assert.equal(await patientPage.locator('.invitation-consent').count(),0);
  await shot(patientPage,'invitation-rejected-en-dark-320');
  await changePreferences(patientPage,{language:'ar',theme:'light'});
  await patientPage.setViewportSize({width:390,height:960});
  check('Rejection requires confirmation, supports keyboard cancellation and retry, blocks replay and survives reload in Arabic and English');

  stage='explicit-consent';link=await createLink(doctorPage,emails.patient);token=tokenFrom(link);await patientPage.goto(link,{waitUntil:"domcontentloaded",timeout:60000});await patientPage.locator('.invitation-consent').waitFor();await patientPage.getByRole('button',{name:'السماح بالاطلاع على سجلاتي',exact:true}).click();await patientPage.getByText(/تم السماح للطبيب/).waitFor();await shot(patientPage,'invitation-approved-ar-light-390');
  assert.equal((await record()).status,200);await patientPage.getByRole('link',{name:'أطبائي',exact:true}).click();await patientPage.getByRole('heading',{name:'د. ليلى محمود',exact:true}).waitFor();
  assert.equal((await request('/connections/invitations/approve',{token:pt,body:{token}})).status,409);await patientPage.goto(link,{waitUntil:"domcontentloaded",timeout:60000});await patientPage.getByText(/استُخدم هذا الرابط/).waitFor();await shot(patientPage,'invitation-used-ar-light-390');
  const second=await request('/connections/invitations',{token:dt,body:{email:emails.other}});const secondInvite=await second.json();assert.equal((await request('/connections/invitations/approve',{token:ot,body:{token:secondInvite.token}})).status,204);
  check('Explicit consent creates the relationship in My Doctors and My Patients; duplicate confirmation/reuse returns 409');

  stage='patient-saves-real-reading';await patientPage.goto(base+'/patient/dashboard',{waitUntil:"domcontentloaded",timeout:60000});await patientPage.locator('.dashboard-record-pressure').click();await patientPage.locator('input[name=systolic]').fill('126');await patientPage.locator('input[name=diastolic]').fill('81');await patientPage.locator('#measurement-add-panel button[type=submit]').click();await patientPage.locator('[data-saved=true]').waitFor();await patientPage.locator('.measurement-save-feedback a').click();await patientPage.waitForFunction(()=>document.querySelector('.metric-number')?.textContent?.includes('126'));await shot(patientPage,'patient-real-save-ar-light-390');check('Real pressure save persists to PostgreSQL, appears in the day log, and updates dashboard timestamp/value');
  const readingsResponse=await request('/measurements',{token:pt});const savedReading=(await readingsResponse.json()).measurements.find(item=>item.kind==='bloodPressure'&&item.systolic===126);assert(savedReading);assert.equal(await patientPage.locator('.metric-time').first().getAttribute('datetime'),savedReading.recordedAt);await patientPage.locator('.reading-saved-label').waitFor();
  const todayLink=patientPage.locator('.week-days a').last();assert.equal(await todayLink.getAttribute('data-day'),day);await todayLink.click();assert.equal(new URL(patientPage.url()).searchParams.get('day'),day);await patientPage.locator('.measurement-entry time[datetime="'+savedReading.recordedAt+'"]').waitFor();assert.equal(await patientPage.locator('.measurement-day').count(),1);await shot(patientPage,'patient-week-reopened-day-ar-light-390');
  await patientPage.goto(base+'/patient/dashboard',{waitUntil:"domcontentloaded",timeout:60000});await patientPage.locator('.today-medication button').first().click();await patientPage.locator('.dose-saved-notice').waitFor();await shot(patientPage,'patient-dose-saved-ar-light-390');await patientPage.locator('.dose-saved-notice button').click();await patientPage.locator('.dose-saved-notice').waitFor({state:'hidden'});await patientPage.locator('.today-medication button').first().click();await patientPage.locator('.dose-saved-notice').waitFor();
  await patientPage.goto(base+'/patient/reports?visit=1',{waitUntil:"domcontentloaded",timeout:60000});await patientPage.locator('.visit-summary').waitFor();assert((await patientPage.locator('.visit-summary').innerText()).includes('126/81'));await shot(patientPage,'patient-visit-summary-ar-light-390');await patientPage.emulateMedia({media:'print'});assert.equal(await patientPage.locator('.app-header').isVisible(),false);assert.equal(await patientPage.locator('.visit-summary').isVisible(),true);await patientPage.pdf({path:resolve(output,'visit-summary.pdf'),format:'A4',printBackground:true});await patientPage.emulateMedia({media:'screen'});check('Patient reopens saved exact timestamp from local week day, records dose and undoes it, and prints verified visit data');
  await recordingSession.send('Page.stopScreencast');recordingSession=null;
  stage='doctor-two-patients';await doctorPage.goto(base+'/doctor/dashboard',{waitUntil:"domcontentloaded",timeout:60000});await doctorPage.locator('.doctor-selection-list li').nth(1).waitFor();
  for(const [name,value] of [['سارة أحمد','126'],['عمر خالد','137']]){await doctorPage.locator('.doctor-selection-list a').filter({hasText:name}).click();await doctorPage.locator('.doctor-record-title').filter({hasText:name}).waitFor();assert((await doctorPage.locator('.clinical-latest-readings').innerText()).includes(value));assert.equal(await doctorPage.locator('.doctor-selected-record form').count(),0);if(name==='سارة أحمد'){assert.equal(await doctorPage.locator('.clinical-latest-readings time').first().getAttribute('datetime'),savedReading.recordedAt);await doctorPage.locator('.patient-activity [role=status]').waitFor({state:'hidden'});await doctorPage.locator('.activity-filters button').nth(2).click();await doctorPage.locator('.activity-day summary').first().click();assert((await doctorPage.locator('.activity-detail').innerText()).includes('تسجيل تناول جرعة'));const eventResponse=await request('/doctor/patients/'+id('patient')+'/activity?date='+day,{token:dt});const activity=await eventResponse.json();assert.equal(await doctorPage.locator('.activity-day summary time').first().getAttribute('datetime'),activity.events.find(item=>item.kind==='dose').recordedAt);await shot(doctorPage,'doctor-dose-timeline-ar-light-1440');await doctorPage.locator('.activity-filters button').first().click();assert.equal(await doctorPage.locator('.comparison-periods section').count(),2);}}
  await shot(doctorPage,'doctor-real-record-ar-light-1440');check('Real doctor selection keeps two patients and their measurements synchronized; clinical record contains no mutation form');

  stage='wrong-account-expiry-revocation';const fresh=await request('/connections/invitations',{token:dt,body:{email:emails.patient}});const freshInvite=await fresh.json();
  const wrongRoleContext=await context(390);const wrongRolePage=await wrongRoleContext.newPage();await wrongRolePage.goto(base+'/patient/invitation#token='+freshInvite.token,{waitUntil:"domcontentloaded",timeout:60000});await wrongRolePage.locator('.invitation-sign-in').click();await signIn(wrongRolePage,emails.admin);await wrongRolePage.getByText(/هذا الحساب لا يمكنه/).waitFor();assert.equal(new URL(wrongRolePage.url()).pathname,'/patient/invitation');await shot(wrongRolePage,'invitation-wrong-role-return-ar-light-390');
  const otherContext=await context(390,'dark');const otherPage=await otherContext.newPage();await otherPage.goto(base+'/login',{waitUntil:"domcontentloaded",timeout:60000});await signIn(otherPage,emails.other);await otherPage.goto(base+'/patient/invitation#token='+freshInvite.token,{waitUntil:"domcontentloaded",timeout:60000});await otherPage.getByText(/هذا الحساب لا يمكنه/).waitFor();assert.equal(await otherPage.locator('.invitation-consent').count(),0);await shot(otherPage,'invitation-wrong-account-ar-dark-390');
  await pool.query("UPDATE chroniccare.patient_invitations SET created_at=now()-interval '20 minutes',expires_at=now()-interval '10 minutes' WHERE token_hash=$1",[hash(freshInvite.token)]);await patientPage.goto(base+'/patient/invitation#token='+freshInvite.token,{waitUntil:"domcontentloaded",timeout:60000});await patientPage.getByText(/الرابط غير صالح أو انتهت/).waitFor();await shot(patientPage,'invitation-expired-ar-light-390');
  await patientPage.goto(base+'/patient/doctors',{waitUntil:"domcontentloaded",timeout:60000});await patientPage.getByRole('button',{name:'سحب الوصول',exact:true}).click();const revokeDialog=patientPage.getByRole('dialog');await revokeDialog.getByRole('button',{name:'سحب الوصول',exact:true}).click();await revokeDialog.waitFor({state:'hidden'});assert.equal((await record()).status,404);assert.equal((await request('/connections/invitations/approve',{token:pt,body:{token}})).status,409);assert.equal((await record()).status,404);check('Wrong account cannot review, expired link cannot confirm, and reused link never restores revoked access');
  check('No real email provider or FCM service called; application database unchanged');assert.deepEqual(report.errors,[]);
  report.status='PASS';console.log(JSON.stringify({status:'PASS',checks:report.checks.length,screenshots:report.screenshots.length,output}));
}catch(error){report.status='FAIL';report.errors.push(`${stage}: ${redact(error.message)}`);console.error(JSON.stringify({status:'FAIL',stage,error:redact(error.message)}));process.exitCode=1;}
finally{if(recordingSession)await recordingSession.send('Page.stopScreencast').catch(()=>{});if(recordingFrames.length){const dir=resolve(output,'screen-frames');await mkdir(dir,{recursive:true});for(let i=0;i<recordingFrames.length;i++)await writeFile(resolve(dir,i+'.jpg'),Buffer.from(recordingFrames[i].data,'base64'));await writeFile(resolve(dir,'frames.json'),JSON.stringify(recordingFrames.map((frame,index)=>({file:index+'.jpg',time:frame.time}))));report.recordingSource='Actual CDP browser screen frames; local GIF encoding follows';}for(const context of contexts)await context.close();if(browser)await browser.close();await fixtures.close();await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));}
