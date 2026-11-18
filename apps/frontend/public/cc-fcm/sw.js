// Standard Web Push handler. This worker owns display; do not add SDK auto-display.
// Provider content is never displayed, including Firebase Console test messages.
const settings=new URL(self.location.href), api=settings.searchParams.get("api");
const english=settings.searchParams.get("lang")==="en";
const home=new URL("../login",self.registration.scope).href;
let pending=Promise.resolve();
self.addEventListener("install",()=>self.skipWaiting());
async function receive(payload) {
  const deliveryId=payload?.data?.deliveryId;
  // Console notifications have no application receipt. Never let a mixed payload
  // bypass receipt validation, even when its deliveryId is invalid.
  const consoleMessage=deliveryId===undefined && payload?.notification && typeof payload.notification==="object";
  let id=deliveryId;
  if (consoleMessage) {
    const messageId=payload.fcmMessageId ?? payload.messageId ?? payload.gcm?.message_id;
    if (typeof messageId!=="string" || !messageId || messageId.length>256) return;
    id=`console-${encodeURIComponent(messageId)}`;
  } else {
    if (typeof id!=="string" || !/^[a-f0-9-]{36}$/i.test(id) || !api) return;
    const endpoint=new URL(api);
    if (endpoint.protocol!=="https:" && !["localhost","127.0.0.1"].includes(endpoint.hostname)) return;
    const response=await fetch(`${api}/notifications/push-receipt/${id}`,{credentials:"include",cache:"no-store",signal:AbortSignal.timeout(5000)});
    if (!response.ok || (await response.json()).eligible!==true) return;
  }
  const cache=await caches.open("cc-push-dedup-v1"), marker=new URL(`seen/${id}`,self.registration.scope).href;
  if (await cache.match(marker)) return;
  const clients=await self.clients.matchAll({type:"window",includeUncontrolled:true});
  const visible=clients.filter(client=>new URL(client.url).origin===self.location.origin && client.visibilityState==="visible");
  for (const client of clients) client.postMessage({type:"cc-push-refresh"});
  // App events refresh the foreground bell. Console tests explicitly test OS display.
  if (consoleMessage || !visible.length) await self.registration.showNotification("ChronicCare AI",{
    body:consoleMessage ? (english ? "Firebase test notification." : "إشعار اختبار Firebase.") : (english ? "You have a new account notification. Sign in to view it." : "لديك إشعار جديد في حسابك. سجّل الدخول للاطلاع عليه."),
    dir:english?"ltr":"rtl",lang:english?"en":"ar",tag:`cc-push-${id}`,renotify:false,data:{route:home},
  });
  // A failed display must remain retryable.
  await cache.put(marker,new Response("1"));
  const keys=await cache.keys(); for (const key of keys.slice(0,Math.max(0,keys.length-256))) await cache.delete(key);
}
self.addEventListener("push",event=>{
  let payload; try { payload=event.data?.json(); } catch { return; }
  pending=pending.then(()=>receive(payload)).catch(()=>{ console.warn("ChronicCare push handling failed."); }); event.waitUntil(pending);
});
self.addEventListener("notificationclick",event=>{
  event.notification.close();
  event.waitUntil(self.clients.openWindow(home)); // Never use a URL from a payload.
});
