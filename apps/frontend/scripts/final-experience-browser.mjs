// Browser review harness for the final experience. All API responses are synthetic.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const root = fileURLToPath(new URL('..', import.meta.url));
const phase = process.argv.includes('--baseline') ? 'before' : 'after';
const output = resolve(root, 'artifacts/final-experience', phase);
await mkdir(output, { recursive: true });
const base = 'http://127.0.0.1:5187';
process.env.VITE_API_URL = base + '/api';
const vite = await createServer({ root, cacheDir: resolve(root, 'node_modules/.vite-final-review'), logLevel: 'error', server: { host: '127.0.0.1', port: 5187, strictPort: true } });
await vite.listen();
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = { mode: 'Synthetic browser API fixtures; no database or external service calls.', screenshots: [], checks: [], errors: [] };
const now = new Date();
const day = [now.getFullYear(), String(now.getMonth()+1).padStart(2,'0'), String(now.getDate()).padStart(2,'0')].join('-');
const patients = [{ id: '11111111-1111-4111-8111-111111111111', name: 'سارة أحمد' }, { id: '22222222-2222-4222-8222-222222222222', name: 'عمر خالد' }];
const readings = n => [
  { id: 'pressure-' + n, kind: 'bloodPressure', systolic: n === 1 ? 124 : 137, diastolic: n === 1 ? 79 : 86, recordedAt: new Date(now.getTime()-3600000).toISOString() },
  { id: 'glucose-' + n, kind: 'glucose', value: n === 1 ? 102 : 116, recordedAt: new Date(now.getTime()-86400000).toISOString() },
  ...Array.from({ length: 6 }, (_, i) => ({ id: 'history-'+n+'-'+i, kind: 'bloodPressure', systolic: 120+i+n, diastolic: 76+i, recordedAt: new Date(now.getTime()-(i+1)*86400000).toISOString() })),
].map(item => ({...item,isExample:false}));
const medications = [{ id: 'medicine-1', name: 'دواء توضيحي', dosage: '10 mg', notes: '', doses: [{ time: '08:00', takenOn: day }, { time: '20:00', takenOn: null }] }];
const habits = [{ id: 'habit-1', title: 'المشي اليومي', unit: 'minutes', target: 30, progress: 15, recordedOn: day, templateKey: null }];
try {
  for (const role of (process.argv.includes('--patient-only') ? ['patient'] : process.argv.includes('--doctor-only') ? ['doctor'] : ['patient', 'doctor'])) {
    for (const language of (process.argv.includes('--matrix') ? ['ar','en'] : ['ar'])) {
    for (const theme of ['light', 'dark']) {
      for (const width of (process.argv.includes('--matrix') ? [1440,390,320] : [1440, 390])) {
        const only=process.argv.find(arg=>arg.startsWith('--case='))?.slice(7);if(only && only!==`${role}:${language}:${theme}:${width}`)continue;
        const context = await browser.newContext({ viewport: { width, height: 960 }, reducedMotion: 'reduce' });
        await context.addInitScript(({theme,language}) => { localStorage.setItem('cc-language',language); localStorage.setItem('cc-theme',theme); }, {theme,language});
        let measurements = readings(1);
        let roster = patients;
        let mismatchedIdentity=false,completedFirst=false;
        let medicationItems=structuredClone(medications),habitItems=structuredClone(habits),fail=false;
        const user = { id: role + '-review', role, name: role === 'patient' ? 'سارة أحمد' : 'د. ليلى محمود', email: role+'@example.test' };
        await context.route(/^https?:\/\/[^/]+\/api\//, async route => {
          const request = route.request(); const path = new URL(request.url()).pathname.replace(/^\/api/, '');
          const headers = { 'access-control-allow-origin': base, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': 'authorization,content-type,x-csrf-token', 'access-control-expose-headers': 'x-account-id', 'x-account-id': user.id };
          const send = (json, status=200) => route.fulfill({ headers, status, json });
          if (request.method() === 'OPTIONS') return route.fulfill({headers,status:204});
          if (path === '/auth/me') return send({user, token:'synthetic-review-session', expiresAt:new Date(Date.now()+3600000).toISOString()});
          if (path === '/auth/csrf') return send({csrfToken:'a'.repeat(64)});
          if(fail && ['/measurements','/medications','/habits'].includes(path))return send({error:{code:'UNAVAILABLE'}},503);
          if (path === '/measurements') {
            if(request.method() === 'POST') { const measurement = { ...request.postDataJSON(), id:'saved-reading', recordedAt:new Date().toISOString(),isExample:false }; measurements.unshift(measurement); return send({measurement},201); }
            return send({measurements});
          }
          if (path === '/medications') return send({medications:medicationItems});
          if (path === '/habits') return send({habits:habitItems});
          if (path === '/doctor/patients') return send({patients:roster});
          if (path.endsWith('/activity')) return send({patientId:path.split('/').at(-2),events:[]});
          if (path.startsWith('/doctor/patients/')) { const n = path.endsWith(patients[0].id) ? 1 : 2; const patient=mismatchedIdentity?patients[1]:roster.find(item=>path.endsWith(item.id)); await new Promise(resolve=>setTimeout(resolve,n===1?350:30));if(n===1)completedFirst=true; return send({patient,date:day,measurements:readings(n),medications,habits}); }
          if (path === '/notifications') return send({notifications:[]});
          if (path === '/notifications/unread-count') return send({unreadCount:0});
          return send({error:{code:'NOT_FOUND'}},404);
        });
        const page = await context.newPage(); page.on('pageerror', error => report.errors.push(error.message));
        await page.goto(base + '/' + role + '/dashboard');
        await page.locator(role === 'patient' ? '.canvas-readings' : '.clinical-roster').waitFor().catch(async error => { console.log(await page.locator('body').innerText()); console.log(report.errors); await page.screenshot({path:resolve(output,'failure.png'),fullPage:true}); throw error; });
        await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(700);
        if(role==='patient')await page.locator('.chart-loading').waitFor({state:'hidden'});
        const path = resolve(output, `${role}-${language}-${theme}-${width}.png`);
        await page.screenshot({path,fullPage:true}); report.screenshots.push(path);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${role} ${theme} ${width} fits`);
        report.checks.push(`${role} ${theme} ${width}: rendered without horizontal overflow`);
        assert(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),'Reduced-motion preference is active');
        if (phase === 'after' && role === 'patient') {
          assert(await page.locator('.today-summary').evaluate(el => Boolean(el.compareDocumentPosition(document.querySelector('.health-canvas')) & Node.DOCUMENT_POSITION_FOLLOWING)), 'Today precedes historical chart in reading order');
          await page.locator('.dashboard-record-pressure').focus();await page.keyboard.press('Enter');
          await page.locator('input[name=systolic]').fill('126');
          await page.locator('input[name=diastolic]').fill('81');
          await page.locator('#measurement-add-panel button[type=submit]').click();
          await page.locator('.measurement-save-feedback a').waitFor();
          assert(await page.locator('[data-saved=true]').innerText().then(text => text.includes('126') || text.includes('١٢٦')), 'Reading log reflects saved value');
          await page.locator('.measurement-save-feedback a').click();
          await page.waitForFunction(() => document.querySelector('.metric-number')?.textContent?.includes('126'));
          assert(await page.locator('.metric-time').first().getAttribute('datetime') === measurements[0].recordedAt, 'Dashboard uses the saved actual timestamp');
          report.checks.push(`patient ${theme} ${width}: pressure save updates day log, dashboard value and timestamp`);
          if(process.argv.includes('--matrix')){
            measurements=[];medicationItems=[];habitItems=[];await page.reload();await page.locator('.today-empty').waitFor();
            assert.equal(await page.locator('.metric-number').first().innerText(),'—');
            assert(await page.locator('.today-medication').innerText().then(text=>text.includes(language==='ar'?'لا توجد جرعات':'No doses')));
            medicationItems=structuredClone(medications);medicationItems[0].doses.forEach(dose=>dose.takenOn=day);await page.reload();
            await page.getByRole('heading',{name:language==='ar'?'تم تسجيل جميع جرعات اليوم':'All today’s doses recorded'}).waitFor();
            fail=true;await page.reload();await page.locator('main [role=alert]').waitFor();fail=false;await page.locator('main').getByRole('button',{name:language==='ar'?'إعادة المحاولة':'Try again',exact:true}).click();await page.locator('.canvas-readings').waitFor();
            measurements=readings(1);habitItems=structuredClone(habits);await page.reload();await page.locator('.canvas-readings').waitFor();await page.locator('.chart-loading').waitFor({state:'hidden'});
            await page.addStyleTag({content:'html { font-size: 200% !important; }'});await page.waitForTimeout(100);
            const zoomShot=resolve(output,`${role}-${language}-${theme}-${width}-text200.png`);await page.locator('.canvas-readings').scrollIntoViewIfNeeded();await page.screenshot({path:zoomShot,fullPage:false,timeout:60000});report.screenshots.push(zoomShot);
            const fits=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);if(!fits)console.log(await page.evaluate(()=>[...document.querySelectorAll('main *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1||el.getBoundingClientRect().left< -1).map(el=>({tag:el.tagName,parent:el.parentElement?.className,html:el.outerHTML.slice(0,160),left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right})).slice(0,20)));assert(fits,'200% text enlargement fits');
            report.checks.push(`patient ${language} ${theme} ${width}: empty readings/no schedules/no habits, completed schedule, server error/retry, 200% text, keyboard record action`);
          }
        }
        if (phase === 'after' && role === 'doctor') {
          if(width===1440) await page.locator('.doctor-record-title').waitFor();
          await page.locator('.doctor-selection-list a').nth(0).click();
          if(width<768) { await page.locator('.doctor-record-title').waitFor(); await page.locator('.embedded-record .doctor-back').click(); }
          await page.locator('.doctor-selection-list a').nth(1).click();
          await page.locator('.doctor-record-title').filter({hasText:patients[1].name}).waitFor();
          assert((await page.locator('.clinical-latest-readings').innerText()).includes('137'), 'Second identity has second measurements');
          await page.waitForTimeout(500);
          assert((await page.locator('.doctor-record-title').innerText()).includes(patients[1].name), 'Late first response cannot overwrite selected identity');
          const recordShot=resolve(output,`doctor-record-${language}-${theme}-${width}.png`); await page.screenshot({path:recordShot,fullPage:true});report.screenshots.push(recordShot);
          assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Focused record fits viewport');
          if(process.argv.includes('--matrix')) {await page.addStyleTag({content:'html {font-size:200% !important}'});await page.waitForTimeout(100);const zoomPath=resolve(output,`doctor-record-${language}-${theme}-${width}-text200.png`);await page.locator(".clinical-latest-readings").scrollIntoViewIfNeeded();await page.screenshot({path:zoomPath,fullPage:false,timeout:60000});report.screenshots.push(zoomPath);const fits=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);if(!fits)console.log(await page.evaluate(()=>[...document.querySelectorAll('main *')].filter(el=>el.namespaceURI!=='http://www.w3.org/2000/svg'&&(el.getBoundingClientRect().right>innerWidth+1||el.getBoundingClientRect().left< -1)).map(el=>({tag:el.tagName,cls:el.className,text:el.textContent?.slice(0,70),left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right})).slice(0,15)));assert(fits,'Record with 200% text fits');}
          if(width<768) {
            await page.locator('.embedded-record .doctor-back').click();
            roster=[...patients,...Array.from({length:14},(_,i)=>({id:`33333333-3333-4333-8333-${String(i).padStart(12,'0')}`,name:`مريض توضيحي ${i+1}`}))];
            await page.reload();await page.locator('.doctor-selection-list a').nth(15).waitFor();
            await page.locator('.doctor-selection-list a').nth(14).scrollIntoViewIfNeeded();const listY=await page.evaluate(()=>scrollY);
            await page.locator('.doctor-selection-list a').nth(14).click();await page.locator('.doctor-record-title').waitFor();await page.locator('.embedded-record .doctor-back').click();
            await page.waitForFunction(expected=>Math.abs(scrollY-expected)<4,listY,{timeout:5000});assert(Math.abs(await page.evaluate(()=>scrollY)-listY)<4,'Mobile restores list scroll position');
            assert(await page.locator('.doctor-selection-list a').nth(14).evaluate(el=>el===document.activeElement),'Return restores focus to selected patient');
            await page.locator('.doctor-selection-list a').nth(14).click();await page.locator('.doctor-record-title').waitFor();await page.goBack();await page.waitForFunction(expected=>Math.abs(scrollY-expected)<4,listY,{timeout:5000});assert(Math.abs(await page.evaluate(()=>scrollY)-listY)<4,'Native browser Back restores the same list position');
          }
          report.checks.push(`doctor ${theme} ${width}: synchronized identity/measurements, late response isolation${width===390?', mobile list position restored':''}`);
          if(process.argv.includes('--matrix') && language==='ar' && theme==='light' && width===1440){
            completedFirst=false;const firstRequest=page.waitForRequest(req=>new URL(req.url()).pathname.endsWith('/doctor/patients/'+patients[0].id));await page.goto(base+'/doctor/dashboard',{waitUntil:'domcontentloaded'});await firstRequest;
            await page.locator('.doctor-selection-list a').nth(1).click();await page.locator('.doctor-record-title').filter({hasText:patients[1].name}).waitFor();await page.waitForTimeout(500);assert(completedFirst,'Slow first response was released after the second request');assert((await page.locator('.doctor-record-title').innerText()).includes(patients[1].name));assert((await page.locator('.clinical-latest-readings').innerText()).includes('137'));
            mismatchedIdentity=true;await page.goto(base+'/doctor/dashboard?patient='+patients[0].id);await page.locator('.doctor-selected-record [role=alert]').waitFor();assert.equal(await page.locator('.doctor-record-title').count(),0,'Mismatched response identity is never displayed');mismatchedIdentity=false;await page.locator('.doctor-selected-record').getByRole('button',{name:'إعادة المحاولة',exact:true}).click();await page.locator('.doctor-record-title').filter({hasText:patients[0].name}).waitFor();report.checks.push('Explicit slow-first/fast-second race and mismatched identity rejection/retry');
          }
        }
        await context.close();
      }
    }
    }
  }
  assert.deepEqual(report.errors, []);
  report.status='PASS';
} catch(error) {
  report.status='FAIL';report.errors.push(error.message);throw error;
} finally {
  const reportName=process.argv.some(arg=>arg.startsWith('--case='))?'report-case.json':process.argv.includes('--doctor-only')?'report-doctor.json':process.argv.includes('--patient-only')?'report-patient.json':'report.json';
  await writeFile(resolve(output,reportName), JSON.stringify(report,null,2));
  await browser.close(); await vite.close();
}
console.log(JSON.stringify(report,null,2));
