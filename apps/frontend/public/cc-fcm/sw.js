// Standard Web Push handler for FCM data-only messages. Provider content is never displayed.
const settings=new URL(self.location.href), api=settings.searchParams.get("api");
const english=settings.searchParams.get("lang")==="en";
const home=new URL("../login",self.registration.scope).href;
let pending=Promise.resolve();
self.addEventListener("install",()=>self.skipWaiting());
async function receive(payload) {
  const id=payload?.data?.deliveryId;
  if (typeof id!=="string" || !/^[a-f0-9-]{36}$/i.test(id) || !api) return;
  const endpoint=new URL(api);
  if (endpoint.protocol!=="https:" && !["localhost","127.0.0.1"].includes(endpoint.hostname)) return;
  const response=await fetch(`${api}/notifications/push-receipt/${id}`,{credentials:"include",cache:"no-store",signal:AbortSignal.timeout(5000)});
  if (!response.ok || (await response.json()).eligible!==true) return;
  const cache=await caches.open("cc-push-dedup-v1"), marker=new URL(`seen/${id}`,self.registration.scope).href;
  if (await cache.match(marker)) return;
  await cache.put(marker,new Response("1"));
  const keys=await cache.keys(); for (const key of keys.slice(0,Math.max(0,keys.length-256))) await cache.delete(key);
  const clients=await self.clients.matchAll({type:"window",includeUncontrolled:true});
  const visible=clients.filter(client=>new URL(client.url).origin===self.location.origin && client.visibilityState==="visible");
  for (const client of clients) client.postMessage({type:"cc-push-refresh"});
  if (visible.length) return;
  await self.registration.showNotification("ChronicCare AI",{
    body:english ? "You have a new account notification. Sign in to view it." : "لديك إشعار جديد في حسابك. سجّل الدخول للاطلاع عليه.",
    dir:english?"ltr":"rtl",lang:english?"en":"ar",tag:`cc-push-${id}`,renotify:false,data:{route:home},
  });
}
self.addEventListener("push",event=>{
  let payload; try { payload=event.data?.json(); } catch { return; }
  pending=pending.then(()=>receive(payload)).catch(()=>undefined); event.waitUntil(pending);
});
self.addEventListener("notificationclick",event=>{
  event.notification.close();
  event.waitUntil(self.clients.openWindow(home)); // Never use a URL from a payload.
});
