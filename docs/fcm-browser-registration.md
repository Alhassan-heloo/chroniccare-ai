# FCM Phase 1 — browser registration only

The PostgreSQL in-app notification record is unchanged and authoritative. This
phase does not send messages, process push payloads or display OS notifications.

## Implementation

The notification dialog includes explicit Enable/Disable controls for each signed-in
session. Opening the dialog never requests permission, initializes Firebase or
registers a worker. Permission is requested only from Enable's click handler.
Missing configuration, insecure context, absent browser support, denied permission,
provider failure, worker conflicts and registration timeouts produce no fake success.

The official Firebase Web SDK `firebase@13.1.0` is dynamically imported only for
opt-in/cleanup. It uses the current `register` + `onRegistered` FID APIs and
`unregister`, rather than mixing legacy token APIs. See the official
[Web guide](https://firebase.google.com/docs/cloud-messaging/web/get-started) and
[API reference](https://firebase.google.com/docs/reference/js/messaging).

The static Vite public worker `public/cc-fcm/sw.js` has the explicit isolated scope
`<BASE_URL>/cc-fcm/`. There was no existing worker. It never intercepts application
fetches, reads messages, imports credentials or displays notifications. A different
active worker at that exact scope is rejected instead of overwritten.

Migration `012_browser_registrations.sql` adds a single table:

- FID primary key, with Firebase's 22-character identifier format constraint.
- Recipient user FK and session FK; deleting a session cascades its registration.
- One installation per session, with creation/update timestamps.
- Parameterized upserts rotate FIDs without leaving duplicate bindings. Claiming
  an active FID belonging to another session/account is rejected, including Admin.

Authenticated API (all roles, always scoped to the current user **and session**):

| Method / path | Contract |
| --- | --- |
| GET `/api/notifications/browser-registration` | `{ registered, context }` |
| PUT same path | `{ fid, context }`, success 204 |
| DELETE same path | `{ context }`, success 204 (idempotent) |

The server-issued context is derived from the session hash. It is not a session
credential or ownership override. A delayed request from another login context is
rejected. Existing CSRF/origin/session protections apply, plus a per-session rate
limit. Owner IDs and client roles are never accepted. No FID or session identifier
is returned by the status API. No identifiers are logged.

Logout and login replacement delete the prior session and hence registration even
if Firebase is unavailable. Server revocation precedes best-effort Firebase
unregistration. Expired bindings are ineligible; a fresh opt-in can reclaim them.
After login, users explicitly opt in again; registration is not silently transferred.
Firebase may retain local installation metadata after logout, but it is no longer
associated with an eligible server-side recipient. Browser permission is a browser
setting and is not reset by logout or Disable.

## Operator setup

Only the separate `_test` database was migrated automatically. After review, from
`apps/backend`, with the intended application `DATABASE_URL` configured privately:

```powershell
npm run db:migrate
npm run dev
```

In Firebase Console create/select the intended project and register a Web app.
Copy its **public Web configuration**. In Project settings → Cloud Messaging →
Web Push certificates, generate a VAPID key pair and use only the public key.
Enable the FCM Registration API if not already enabled for the project. Configure
API-key application/API restrictions appropriate to the deployed origin. Use HTTPS
(localhost is allowed for development); supported browser capabilities are checked
at runtime. Some mobile platforms require an installed web app.

Configure in the frontend's private `.env.local`, using `.env.example` as a guide:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_VAPID_KEY
```

Restart Vite (`npm run dev`) or rebuild after changing these build-time variables.
No server Firebase credential is needed in Phase 1. Never put service-account JSON,
OAuth credentials or private keys into a `VITE_*` variable. No Analytics, Firebase
Auth, Firestore, or Firebase AI service is initialized.

## Verification and manual steps

Automated test command from `apps/backend` (requires distinct TEST_DATABASE_URL
ending in `_test`):

```powershell
node --env-file-if-exists=.env --import tsx --test --test-concurrency=1 tests/browser-registrations.test.ts tests/notifications.test.ts tests/database.test.ts
```

Real DB tests cover unauthenticated requests, CSRF, invalid FIDs, untrusted owner
fields, concurrent duplicates, role isolation, stale session context, FID rotation,
revocation, session deletion, expiry and persistence across store instances.

`node scripts/notifications-browser.mjs` from `apps/frontend` uses Edge and the real
Express/test PostgreSQL backend. It first checks missing configuration/no prompt,
then mocks only the external Firebase/browser adapter to exercise explicit Enable
and Disable. Existing notification flows, Arabic/mobile/light and English/desktop/dark
remain covered. No live Firebase credentials, Firebase requests or push sends are
used. Playwright must be installed or supplied via `PLAYWRIGHT_MODULE_PATH`.

Manual verification with test accounts and a real configured Firebase project:

1. Sign in and open the bell. No permission prompt should appear.
2. Click Enable; deny permission and confirm clear feedback with no saved binding.
3. Allow notifications in site settings, click Enable again and wait for server
   confirmation. GET status should report registered, with one row in the test DB.
4. Refresh: status persists. Disable: status becomes unregistered. In-app entries
   remain untouched, including their read states.
5. Enable, logout, sign in as a different account: it starts unregistered and must
   opt in separately. The old session's binding is removed.

## Limits / Phase 2 requirements

Live Firebase enrollment and provider-side unregistration were not exercised with
real credentials. Automated success uses a mocked external adapter. Browser support
is capability checked; this is not an exhaustive device matrix.

Automatic FID rotation/reconciliation while the page is closed is not implemented.
Explicit registration handles the current FID and replaces its old session binding.
Expired rows may remain until session cleanup or FID reclamation, but must never be
eligible for delivery. FID syntax validation is not independent attestation of browser
possession; it cannot authorize clinical access.

Phase 2 still needs server-only Firebase delivery credentials and an FID-compatible
send integration, an outbox/idempotent dispatch tied to authoritative notification
records, active-session/consent checks at dispatch, invalid-FID cleanup, provider
callback reconciliation, generic previews only, safe worker/background handling and
notification-click authorization. Never send identities or medical details in push
payloads, and never target stale registrations without rechecking eligibility.

`npm audit --omit=dev` reports 6 high-severity entries: Firebase's unused
Firestore/grpc dependency chain and existing follow-redirects/Zod dependencies.
Only app/messaging are imported into browser chunks; Firestore/grpc are not used by
this feature. No broad `audit fix` or forced downgrade was performed. Dependency
remediation remains a deployment review item; passing tests is not a production
readiness claim.

Changed files: backend migration 012, `notifications/registrations.ts`, app/server
wiring, database whitelist and registration tests; frontend Firebase dependency and
lockfile, public worker, `lib/notifications/browser.ts`,
`BrowserNotificationControl.tsx`, NotificationCenter, Arabic/English catalogs,
`.env.example`, and the existing focused notification browser script. Existing
uncommitted package.json script changes are preserved. No commit or push occurred.
