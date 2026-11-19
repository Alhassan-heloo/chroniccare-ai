import { useSyncExternalStore } from "react";

type InstallChoice = { outcome: "accepted" | "dismissed" };
interface InstallPromptEvent extends Event {
  prompt(): Promise<InstallChoice | void>;
  userChoice?: Promise<InstallChoice>;
}

type InstallState = "manual" | "available" | "pending" | "dismissed" | "installed";
const storageKey = "cc-install-dismissed";
const standalone = typeof window !== "undefined" ? window.matchMedia("(display-mode: standalone)") : undefined;
const inStandalone = () => standalone?.matches || (typeof navigator !== "undefined"
  && (navigator as Navigator & { standalone?: boolean }).standalone === true);

function wasDismissed() {
  try { return window.sessionStorage.getItem(storageKey) === "1"; }
  catch { return false; }
}

let state: InstallState = inStandalone() ? "installed" : wasDismissed() ? "dismissed" : "manual";
let deferredPrompt: InstallPromptEvent | undefined;
const listeners = new Set<() => void>();

function setState(next: InstallState) {
  if (state === next) return;
  state = next;
  listeners.forEach(listener => listener());
}

function markInstalled() {
  deferredPrompt = undefined;
  setState("installed");
}

function finishPrompt(choice?: InstallChoice | void) {
  if (state !== "pending") return;
  if (choice?.outcome === "accepted") return markInstalled();
  if (choice?.outcome === "dismissed") {
    try { window.sessionStorage.setItem(storageKey, "1"); } catch { /* Storage can be blocked. */ }
    setState("dismissed");
    return;
  }
  setState("manual");
}

// Listen at startup so availability survives closing the menu and React route changes.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", event => {
    const prompt = event as InstallPromptEvent;
    if (typeof prompt.prompt !== "function") return;
    event.preventDefault();
    if (state !== "manual" && state !== "available") return;
    deferredPrompt = prompt;
    setState("available");
  });
  window.addEventListener("appinstalled", markInstalled);
  standalone?.addEventListener("change", () => {
    if (inStandalone()) markInstalled();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export const usePhoneInstallState = () => useSyncExternalStore(subscribe, () => state, () => "manual" as const);

export async function requestPhoneInstall() {
  if (state !== "available" || !deferredPrompt) return;
  const prompt = deferredPrompt;
  deferredPrompt = undefined;
  setState("pending");
  try {
    // Called directly from the click handler to preserve the browser's user activation.
    finishPrompt(await prompt.prompt() ?? await prompt.userChoice);
  } catch {
    // A stale/failed browser prompt returns the user to the manual steps.
    finishPrompt();
  }
}
