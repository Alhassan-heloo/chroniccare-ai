// Registration-only worker, isolated from application/PWA scopes.
// No fetch interception, payload processing, notification display or delivery yet.
self.addEventListener("install", () => self.skipWaiting());
