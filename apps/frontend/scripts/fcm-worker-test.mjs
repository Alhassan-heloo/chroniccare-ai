import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=await readFile(new URL('../public/cc-fcm/sw.js',import.meta.url),'utf8');
const listeners={}, seen=new Map(), shown=[];
let visible=false, eligible=true, receipts=0, refreshes=0, fail=false;
const scope='https://example.test/cc-fcm/';
const self={location:{href:scope+'sw.js?api=https://example.test/api&lang=en',origin:'https://example.test'},registration:{scope,showNotification:async(title,options)=>{if(fail)throw Error('display');shown.push({title,options});}},clients:{matchAll:async()=>visible?[{url:'https://example.test/patient/dashboard',visibilityState:'visible',postMessage:()=>refreshes++}]:[],openWindow:async()=>{}},addEventListener:(type,fn)=>listeners[type]=fn};
const context=vm.createContext({self,URL,Response,AbortSignal,console:{warn:()=>{}},fetch:async()=>{receipts++;return {ok:true,json:async()=>({eligible})};},caches:{open:async()=>({match:async key=>seen.get(key),put:async(key,value)=>seen.set(key,value),keys:async()=>[...seen.keys()],delete:async key=>seen.delete(key)})}});
vm.runInContext(source,context);
async function push(payload){let done;listeners.push({data:{json:()=>payload},waitUntil:p=>done=p});await done;}
const app=id=>({data:{deliveryId:`00000000-0000-0000-0000-${String(id).padStart(12,'0')}`}});
await push({notification:{title:'private content',body:'private body'},fcmMessageId:'test/1'});
assert.equal(shown.length,1);assert.equal(receipts,0);assert.equal(shown[0].options.body,'Firebase test notification.');
await push({notification:{title:'duplicate'},fcmMessageId:'test/1'});assert.equal(shown.length,1);
visible=true;await push(app(1));assert.equal(shown.length,1);assert.equal(refreshes,1);
await push({notification:{title:'foreground test'},fcmMessageId:'test2'});assert.equal(shown.length,2);
visible=false;await push(app(2));await push(app(2));assert.equal(shown.length,3);
eligible=false;await push({...app(3),notification:{title:'cannot bypass'}});assert.equal(shown.length,3);
await push({data:{deliveryId:'invalid'},notification:{title:'cannot bypass'},fcmMessageId:'test3'});assert.equal(shown.length,3);
eligible=true;fail=true;await push(app(4));assert.equal(shown.length,3);fail=false;await push(app(4));assert.equal(shown.length,4);
await push({data:{unknown:'ignored'}});await push({notification:{title:'no id'}});assert.equal(shown.length,4);
// Concurrent duplicate push events are serialized by event.waitUntil.
await Promise.all([push(app(5)),push(app(5))]);assert.equal(shown.length,5);
assert.equal(shown[4].options.data.route,'https://example.test/login');
console.log('PASS: Console foreground/background, generic privacy, app foreground/background, deduplication, receipt rejection, malformed payloads, display retry, concurrent events, safe click route. Mocked Web Push; no live FCM send.');
