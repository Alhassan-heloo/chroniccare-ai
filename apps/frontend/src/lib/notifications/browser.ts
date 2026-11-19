// Public Firebase web configuration only. Never put service-account credentials here.
import { apiBaseUrl } from "@/lib/api/baseUrl";
const env = import.meta.env ?? {};
const config = { apiKey: env.VITE_FIREBASE_API_KEY, projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID, messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID };
export function browserAvailability(): "missing" | "insecure" | "unsupported" | "denied" | null {
  if (!Object.values(config).every(Boolean) || !env.VITE_FIREBASE_VAPID_KEY) return "missing";
  if (!window.isSecureContext) return "insecure";
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  return Notification.permission === "denied" ? "denied" : null;
}
async function messaging() {
  const [{ initializeApp, getApps }, sdk] = await Promise.all([import("firebase/app"), import("firebase/messaging")]);
  if (!await sdk.isSupported()) throw new Error("unsupported");
  const app = getApps().find(app => app.name === "chroniccare-push") ?? initializeApp(config, "chroniccare-push");
  return { sdk, instance: sdk.getMessaging(app) };
}
let busy = false;
function workerConfiguration() {
  const base = new URL(import.meta.env.BASE_URL, location.origin);
  const scope = new URL("cc-fcm/", base).href, scriptURL = new URL("cc-fcm/sw.js", base);
  scriptURL.searchParams.set("api", new URL(apiBaseUrl, location.origin).href);
  scriptURL.searchParams.set("lang", document.documentElement.lang.startsWith("en") ? "en" : "ar");
  return {scope,scriptURL};
}
// Upgrade only our already-installed worker, after the server confirms opt-in.
// No Firebase initialization or permission request is involved.
export async function upgradePushWorker() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
  const {scope,scriptURL}=workerConfiguration(), existing=await navigator.serviceWorker.getRegistration(scope);
  if (existing?.scope===scope && existing.active && new URL(existing.active.scriptURL).pathname===scriptURL.pathname)
    await navigator.serviceWorker.register(scriptURL.href,{scope});
}
export async function registerBrowser(): Promise<string> {
  const unavailable = browserAvailability();
  if (unavailable) throw new Error(unavailable);
  if (busy) throw new Error("busy");
  busy = true;
  try {
    // This call runs in the click handler, before loading SDK modules or awaiting anything.
    if (await Notification.requestPermission() !== "granted") throw new Error("denied");
    const { sdk, instance } = await messaging();
    const {scope,scriptURL}=workerConfiguration();
    const script=scriptURL.href;
    const existing = await navigator.serviceWorker.getRegistration(scope);
    if (existing && existing.scope === scope && existing.active && new URL(existing.active.scriptURL).pathname !== scriptURL.pathname) throw new Error("workerConflict");
    const worker = await navigator.serviceWorker.register(script, { scope });
    if (!worker.active) await new Promise<void>((resolve, reject) => {
      const installing = worker.installing ?? worker.waiting;
      if (!installing) return reject(new Error("worker"));
      const timer = setTimeout(() => { installing.removeEventListener("statechange", changed); reject(new Error("timeout")); }, 15000);
      const changed = () => { if (installing.state === "activated" || installing.state === "redundant") {
        clearTimeout(timer); installing.removeEventListener("statechange", changed);
        if (installing.state === "activated") resolve(); else reject(new Error("worker"));
      } };
      installing.addEventListener("statechange", changed); changed();
    });
    return await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => { stop(); reject(new Error("timeout")); }, 20000);
      const stop = sdk.onRegistered(instance, fid => { clearTimeout(timer); stop(); resolve(fid); });
      void sdk.register(instance, { vapidKey: env.VITE_FIREBASE_VAPID_KEY, serviceWorkerRegistration: worker })
        .catch(() => { clearTimeout(timer); stop(); reject(new Error("provider")); });
    });
  } finally { busy = false; }
}
export async function unregisterBrowser() {
  if (browserAvailability()) return;
  const { sdk, instance } = await messaging();
  await sdk.unregister(instance);
}
