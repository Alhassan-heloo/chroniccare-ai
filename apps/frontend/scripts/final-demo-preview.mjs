// Keep a real local preview alive using only this run's disposable synthetic accounts.
import { randomBytes, randomUUID } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { doctorBrowserFixtures } from './doctor-browser-fixtures.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));const output=resolve(root,'artifacts/final-experience');await mkdir(output,{recursive:true});
const password=randomBytes(18).toString('base64url');const suffix=randomUUID().slice(0,8);
const emails={admin:`admin-${suffix}@demo.example.test`,doctor:`doctor-${suffix}@demo.example.test`,patient:`sara-${suffix}@demo.example.test`,other:`omar-${suffix}@demo.example.test`,invited:`invite-${suffix}@demo.example.test`};
const fixture=await doctorBrowserFixtures({frontendPort:5197,backendPort:3317,emails:Object.values(emails),password});
let shuttingDown=false;
async function stop(){if(shuttingDown)return;shuttingDown=true;await fixture.close();process.exit();}
try{
  const at=await fixture.start(emails.admin);await fixture.pool.query('UPDATE chroniccare.users SET name=$1 WHERE email=$2',['مسؤول العرض',emails.admin]);
  await fixture.inviteDoctor(at,emails.doctor,'د. ليلى محمود');
  for(const [key,name] of [['patient','سارة أحمد'],['other','عمر خالد'],['invited','نور علي']]){
    const response=await fixture.request('/auth/register',{body:{name,email:emails[key],password}});if(response.status!==201)throw Error('Demo fixture creation failed.');
  }
  const dt=await fixture.login(emails.doctor,'doctor');
  const day=new Date().toLocaleDateString('en-CA');
  for(const [key,systolic,diastolic,value] of [['patient',124,79,102],['other',137,86,116]]){
    const pt=await fixture.login(emails[key],'patient');
    for(let i=0;i<7;i++){
      const recordedAt=new Date(Date.now()-i*86400000).toISOString();
      const response=await fixture.request('/measurements',{token:pt,body:{kind:'bloodPressure',systolic:systolic+i%3,diastolic:diastolic+i%2,recordedAt}});if(response.status!==201)throw Error('Demo reading creation failed.');
    }
    await fixture.request('/measurements',{token:pt,body:{kind:'glucose',value,recordedAt:new Date(Date.now()-86400000).toISOString()}});
    await fixture.request('/medications?date='+day,{token:pt,body:{name:'دواء توضيحي',dosage:'10 mg',notes:'بيانات مصطنعة للعرض فقط',doses:[{time:'08:00'},{time:'20:00'}]}});
    const result=await fixture.request('/habits?date='+day,{token:pt,body:{title:'المشي اليومي',unit:'minutes',target:30}});const {habit}=await result.json();
    await fixture.request(`/habits/${habit.id}/progress`,{token:pt,method:'PUT',body:{date:day,value:15}});
    const invitation=await fixture.request('/connections/invitations',{token:dt,body:{email:emails[key]}});const {token}=await invitation.json();
    if((await fixture.request('/connections/invitations/approve',{token:pt,body:{token}})).status!==204)throw Error('Demo consent failed.');
  }
  const lines=['# حسابات العرض المصطنعة','',`الرابط: ${fixture.base}`,'','هذه الحسابات داخل PostgreSQL مستقل للعرض فقط. لا تستخدم بيانات أشخاص حقيقيين.','',`كلمة مرور حسابات العرض: ${password}`,'','| الدور | البريد |','|---|---|',...Object.entries(emails).map(([key,email])=>`| ${key} | ${email} |`),'','المريض invited (نور علي) غير مرتبط بعد؛ استخدمه لتجربة رابط الدعوة.','لإعادة تجربة إنشاء طبيب، استخدم بريدًا جديدًا ضمن example.test من حساب الإدارة.','إيقاف عملية المعاينة ينظف حسابات هذا التشغيل فقط.'];
  await writeFile(resolve(output,'DEMO-ACCESS.md'),lines.join('\n'));
  await writeFile(resolve(output,'preview.json'),JSON.stringify({url:fixture.base,api:fixture.api,mode:'Real isolated PostgreSQL with synthetic accounts',pid:process.pid},null,2));
  process.on('SIGINT',()=>void stop());process.on('SIGTERM',()=>void stop());
  console.log(`READY ${fixture.base} — synthetic access details saved to artifacts/final-experience/DEMO-ACCESS.md`);
  await new Promise(()=>{});
}catch(error){console.error('Preview setup failed; private connection details withheld. '+error.name);await fixture.close();process.exitCode=1;}
