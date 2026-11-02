# FCM Phase 2 — secure push delivery

## Data flow and scope

Only the existing connection-approved/revoked notification events can enqueue push.
The PostgreSQL in-app record remains authoritative. Migration 013 adds a disabled
`push_control` singleton, a `push_jobs` outbox, and an AFTER INSERT notification
trigger. It does not modify previous migrations, clinical records, or registrations.
It does not backfill historical notifications. The outbox snapshots only registrations
already opted in at event time; later registration cannot pick up past events.

Outbox rows commit with the notification transaction. Workers cannot see uncommitted
events. A failed provider call cannot roll back that originating transaction.
Deployment must use the same FCM configuration on all backend instances. Enabling
from disabled advances an epoch; pending jobs from earlier epochs are skipped.
Restarts with delivery still enabled preserve the epoch and eligible pending jobs.

The Express process polls every two seconds. PostgreSQL `SKIP LOCKED`, durable attempt
counts and 60-second leases prevent concurrent workers sending the same active job.
There are at most four attempts, exponential delays (60/120/240 seconds), and a
five-minute eligibility window. Expired leases are recoverable after a crash.
Registration/session rows are locked during the bounded provider call, serializing
that call with logout/revocation. All ownership, original registration identity,
consent and idle/absolute session expiry checks run immediately before sending.
UNREGISTERED responses remove only the affected session's registration. Other
permanent errors terminate the job; temporary failures retain bounded retries.

FCM HTTP v1 is used directly with `message.fid`, not legacy token targeting.
Server-only service-account OAuth uses a signed RS256 JWT, Google's fixed OAuth
endpoint and the `firebase.messaging` scope, with cached short-lived access tokens.
Both authorization and send requests have 10-second timeouts. There is no new SDK
dependency and no API to ask the server to send arbitrary messages.

References: [HTTP v1](https://firebase.google.com/docs/cloud-messaging/send/v1-api),
[FID message schema](https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages).

## Browser privacy and race protection

FCM gets only the installation target and an opaque random delivery UUID. No title,
account identifier, event description, name or medical record is in the payload.
It is data-only, with TTL 60 seconds, so Firebase cannot auto-display a stale preview.

The isolated existing worker uses standard Web Push APIs. Before rendering, it
calls `GET /api/notifications/push-receipt/:deliveryId` with the current HttpOnly
cookie. This endpoint checks the precise job/session/registration/user relationship,
deployment epoch and expiry without renewing session idle time. Unknown, expired,
revoked and switched-account jobs fail closed. Offline receipt validation also
suppresses display. This endpoint does not expose the notification or user record.

Visible application tabs receive a message to refresh the existing bell instead
of an OS notification. Background delivery displays a fixed Arabic/English generic
preview. The worker remembers 256 delivery IDs in CacheStorage and uses a stable
notification tag to suppress duplicate delivery. It serializes concurrent push events.
Notification clicks always open the same-origin shared Login, ignoring all payload
URLs. The normal role/auth routing then applies. OS notifications use OS styling;
the foreground bell keeps Living 3.3 themes.

For existing opted-in users, opening the notification dialog upgrades only this
application's already-installed worker, without Firebase initialization or prompting
for permission. The current UI language is passed to the worker. Opening the dialog
while not opted in does not install a worker or request permission.

## Operator configuration and controlled live test

No application/production migration or real push send was performed by Codex.
Only the separate test DB was migrated. After review:

1. From `apps/backend`, configure the intended `DATABASE_URL` privately and run
   `npm run db:migrate` (applies migration 013). Restart the backend after migrations.
2. Use a dedicated Firebase test project first. Enable the FCM API and Registration
   API. Keep the existing frontend Firebase Web/VAPID configuration from Phase 1.
3. Create a least-privilege service account with `cloudmessaging.messages.create`
   for the target project (Firebase Cloud Messaging API Admin role). Keep its JSON
   outside the repository and web root with restricted file permissions.
4. Configure backend-only variables:

   ```text
   FCM_ENABLED=true
   FCM_PROJECT_ID=your-project-id
   GOOGLE_APPLICATION_CREDENTIALS=/secure/path/service-account.json
   ```

   If FCM_ENABLED is absent/false, no provider calls occur. Invalid credentials or
   missing settings disable push with a generic log; in-app APIs remain available.
   Provider outages fail jobs safely. Rotate service-account keys through the
   operator's secret-management process; restart after credential changes.
5. Run `npm run dev` in backend and frontend (or their production build/start).
   Deploy with HTTPS and a same-site API; preferably reverse-proxy `/api` on the
   same origin. Keep `VITE_API_URL`, CORS and secure-cookie configuration aligned.
   Cross-site cookies blocked by the browser suppress display safely.
6. Using only test Doctor/Patient accounts, explicitly enable browser notifications.
   Complete a new connection approval. With a visible tab, verify the bell updates
   without a second OS preview. Background all tabs and revoke a connection to
   verify a generic OS preview. Old notifications must not be delivered.
7. Test logout, switching accounts and disabling browser registration before a
   delayed message arrives. It must not display that former session's event.
   Click a valid preview: only the same-origin Login should open.
8. Inspect `push_jobs.state/attempts` in the separate test DB. Do not log keys,
   FIDs, session hashes or provider payloads. Set FCM_ENABLED=false on all instances
   and restart to stop enqueue/delivery. In-app notifications continue normally.

## Actual checks

- Backend TypeScript, ESLint, build; focused real PostgreSQL suites: 6/6 passed.
- Suites cover configuration, mocked HTTP v1 FID payloads, provider failure/timeout,
  invalid FID cleanup, commit visibility, rollback, no backfill, concurrent workers,
  bounded retries, expired lease recovery, revoked/expired/deleted sessions,
  read-receipt authorization/isolation and no background idle renewal.
- Frontend TypeScript, ESLint, smoke tests, translations (666 keys), production build.
- Edge/real Express/test PostgreSQL: 18 checks, including an actual registered service
  worker with mocked OS display. Foreground refresh, background generic rendering,
  duplicate suppression and rejection after deregistration passed. External Firebase
  calls are mocked; automated tests never send real pushes.
- Browser results: `apps/frontend/artifacts/notifications/report.json`.

Reproduce from backend, with a distinct TEST_DATABASE_URL ending in `_test`:

```powershell
node --env-file-if-exists=.env --import tsx --test --test-concurrency=1 tests/push.test.ts tests/browser-registrations.test.ts tests/notifications.test.ts tests/database.test.ts
```

Browser test from frontend: `node scripts/notifications-browser.mjs` (requires Edge
and Playwright, or PLAYWRIGHT_MODULE_PATH pointing to an existing installation).

## Dependency review

The six original High findings represent three leaf problems, not six unrelated
runtime vulnerabilities. Only two compatible lockfile patches were applied:

| Path | Runtime exposure / action |
| --- | --- |
| direct `zod` | Used by form validation; 4.6.5 → 4.6.7 fixes resource exhaustion. Existing smoke/build checks passed. |
| `axios → follow-redirects` | Node HTTP adapter dependency; browser builds use browser adapters. 1.16.1 → 1.16.2 fixes cross-realm credential forwarding. |
| `firebase → @firebase/firestore → @grpc/grpc-js` (also firestore-compat) | Firestore pins `~1.9.0`, currently 1.9.16. Not initialized/imported by this application; app/messaging browser chunks do not use the Node gRPC certificate API. Four audit entries remain through this one path. |

Official advisories:
[Zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5),
[follow-redirects](https://github.com/advisories/GHSA-mrwp-f3q8-3g9p),
[gRPC](https://github.com/advisories/GHSA-m9gg-hp2v-232j).
gRPC patched branches include 1.13.6 / 1.14.5+, outside Firestore's pin. The audit's
suggested Firebase downgrade to 9.14.0 would remove the required current FID APIs;
it was not applied. No forced transitive override or broad dependency upgrade was
made. `npm audit --omit=dev` now reports four High entries, zero other production
entries. These unused paths are not a demonstrated exploit in this browser-only
feature, but require an explicit deployment security decision. A policy requiring
zero High findings blocks release; enabling Node Firestore/gRPC without remediation
also blocks release. Do not describe the project as fully remediated or production
ready solely because feature tests pass.

## Limits

No live Firebase credentials/network delivery was tested. Real OS/browser delivery,
browser vendor throttling and mobile installation restrictions need the controlled
test above. A crash after provider acceptance but before DB commit can cause a retry:
delivery is at-least-once, with browser deduplication safeguards, not exactly-once.
Clearing browser storage removes dedup history. A notification already displayed
cannot be guaranteed retractable; all previews remain generic and clicks require
normal authentication. There is an unavoidable small logout-after-receipt-check
race, but no former-account or medical details are ever displayed.

Offline/expired deliveries are intentionally dropped, not replayed. Some browsers
may show their own generic background-activity notice for suppressed data pushes.
Language updates when an opted-in user opens the dialog; OS theme is OS-controlled.
Automatic closed-page FID rotation remains outside the existing manual-registration
lifecycle; stale FIDs are removed when the provider explicitly reports UNREGISTERED.
Outbox terminal-row retention/operational monitoring require a deployment policy.
On startup DB unavailability, restart after recovery to initialize dispatch.

Changed: migration 013; backend push/provider modules, app/server wiring, env example,
database whitelist and tests; existing worker, browser registration helper/control,
NotificationCenter, Arabic/English copy, browser test and targeted frontend lockfile.
The pre-existing frontend `.env.example` edits were preserved. No commit or push.
