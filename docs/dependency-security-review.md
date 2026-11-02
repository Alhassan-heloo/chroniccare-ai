# Focused production dependency review — 2026-11-02

## Decision

Do not mark the four Firebase High findings as fixed. No compatible stable upstream
fix currently exists inside Firestore's declared dependency range. Firebase/FID
functionality was retained unchanged, without overrides, exclusions, downgrades or
audit suppression. Recommend keeping unrestricted production approval blocked until
an upstream fix is adopted or the deployment owner formally accepts the documented
non-reachable dependency risk. Tests alone do not establish production readiness.

An additional, compatible backend fix **was** applied: `body-parser` 2.3.0 → 2.4.0
through Express's existing `^2.3.0` range. No application dependency ranges changed.

## Initial and final production audit

Commands executed separately in each app: `npm audit --omit=dev --json`.

| Application | Initial | Final |
| --- | --- | --- |
| React frontend | 4 High, 0 other production findings | 4 High, unchanged; audit exits 1 |
| Express backend | 1 additional High in body-parser | 0 production findings; audit exits 0 |

These are production audits, not claims that all development tooling is clean.
No account, database or credential was changed during this review.

## The four original findings

| Package / installed version | Dependency route | Nature |
| --- | --- | --- |
| `firebase@13.1.0` | Direct dependency | Aggregate High inherited from Firestore |
| `@firebase/firestore@4.19.0` | firebase → firestore | Aggregate High inherited from grpc-js |
| `@firebase/firestore-compat@0.4.16` | firebase → firestore-compat → firestore | Aggregate High inherited through the same grpc-js installation |
| `@grpc/grpc-js@1.9.16` | firebase → firestore → grpc-js | Actual vulnerable leaf dependency |

Thus four package-level High findings are **not four distinct High vulnerabilities**.
The leaf has a High advisory and a second Low advisory; npm aggregates the leaf at
its highest severity and propagates it to the three ancestors.

- [GHSA-m9gg-hp2v-232j / CVE-2026-101916](https://github.com/advisories/GHSA-m9gg-hp2v-232j):
  gRPC servers using `requireClientCertificate:false` and authenticating callers
  from `getAuthContext()` may accept an unauthorized client certificate. The
  affected authentication behavior is a Node gRPC server path, not browser FCM.
- [GHSA-f596-whhp-79r4 / CVE-2026-101915](https://github.com/advisories/GHSA-f596-whhp-79r4):
  Low-severity disclosure of handler exception text to gRPC clients. Requires a
  gRPC server running application method handlers.

Patched branches are 1.13.6 and 1.14.5+. The registry currently reports grpc-js
1.14.7 as latest. Firestore declares `~1.9.0`; the newest published 1.9 version is
1.9.16, which remains affected. Installing 1.14.x would require violating that pin.

## Reachability evidence

1. The only Firebase imports in application source are the existing dynamic imports
   of `firebase/app` and `firebase/messaging` in `lib/notifications/browser.ts`.
   There is no Firestore/compat/root Firebase import.
2. A new reusable check, `apps/frontend/scripts/audit-firebase-bundle.mjs`, builds
   using the **actual** Vite production configuration and inspects Rollup module
   IDs and emitted chunk module membership. It does not rely on matching minified
   text or on assuming tree shaking worked.
3. Actual result: **2466 loaded modules, 2244 emitted modules; zero Firestore,
   firestore-compat or grpc-js modules in either set**. Firebase app, messaging,
   installations and their supporting modules are retained.
4. The full evidence is in
   `apps/frontend/artifacts/dependency-security/bundle-reachability.json`.
   Reproduce from frontend with `node scripts/audit-firebase-bundle.mjs`.
   The check fails if the currently absent packages enter the production graph;
   it does not remove them from npm audit or accept their vulnerabilities.
5. Backend production dependencies and notification implementation were inspected:
   the backend uses FCM HTTP v1 via built-in fetch/crypto, with no Firebase,
   Firestore or grpc-js package. The frontend's dependency tree is not its backend
   runtime tree.

The documented gRPC server exploit prerequisites are therefore absent from the
current browser build and Express deployment. This is evidence of non-reachability
in the reviewed configuration, **not** a fix to the installed vulnerable package.
An SSR migration, new Firestore/Node import or deployment of a new gRPC service
invalidates this assessment. Shipping only `frontend/dist` keeps the installed
frontend node_modules tree out of the web deployment artifact. Supply-chain/build
environment risks and future vulnerabilities are not ruled out by this check.

## Supported fixes checked

- npm stable `firebase` latest: **13.1.0**, matching the installed version.
- npm stable `@firebase/firestore` latest: **4.19.0**, still pinning `~1.9.0`.
- Firebase `next` is **13.2.0-20261030160918**, a prerelease, not a verified stable
  remediation. It was not installed.
- Firebase's current [release notes](https://firebase.google.com/support/release-notes/js)
  and upstream [pinning issue #10400](https://github.com/firebase/firebase-js-sdk/issues/10400)
  were reviewed alongside local package manifests and npm registry metadata.
- npm audit suggests Firebase **9.14.0** as a forced downgrade. That is not an
  acceptable fix for this application's current `register/onRegistered/unregister`
  FID APIs. No downgrade or force operation was run.
- No unofficial package fork, package removal, experimental version or transitive
  override was adopted. Directly swapping the public umbrella for implementation
  packages was not treated as a supported drop-in security fix.

## Additional backend finding and fix

`express@5.3.0 → body-parser@2.3.0` was independently reported by the backend
production audit. [GHSA-27r3-jxmh-p828 / CVE-2026-111181](https://github.com/advisories/GHSA-27r3-jxmh-p828)
describes a pre-authentication denial of service from a compressed frame followed
by trailing bytes. The existing application already sets `inflate:false`, the
advisory's documented workaround. The middleware itself is reachable on requests,
so the compatible fix was still justified as defense in depth.

`npm update body-parser --ignore-scripts --no-fund` changed only its lockfile entry
to **2.4.0**, allowed by Express's `^2.3.0` range. Express stayed at 5.3.0. No auth,
parser settings, API contracts or account storage were altered.

## Actual validation

- Frontend TypeScript and ESLint: passed.
- Actual Vite production build with graph assertions: passed; usual non-fatal
  Zod comment-annotation warnings remain.
- Frontend smoke suite: passed, including notification response parsing and
  existing patient calculations/forms.
- Edge: imported the installed Firebase app/messaging modules and verified
  `register`, `onRegistered`, `unregister`, `isSupported` are functions. Missing
  configuration rejects registration with zero permission prompts, zero Firebase
  app initialization and zero installed workers. No Firebase calls were made.
- Backend TypeScript, ESLint and production build: passed.
- `node --import tsx --test --test-concurrency=1 tests/app.test.ts`: **9/9 passed**.
  Includes compressed JSON/trailing-byte rejection with continued API liveness,
  ordinary JSON validation/size errors, and notification list/count/read plus FID
  registration/revocation over real Express HTTP with in-memory stores, CSRF and
  untrusted ownership-field rejection. No database/accounts were modified.
- `node --import tsx --test --test-name-pattern='HTTP v1' tests/push.test.ts`:
  **1/1 passed**, mocked provider configuration, FID payload, invalid-FID and
  provider failure handling. The database test was not selected.
- Final production audits: frontend remains 4 High; backend zero vulnerabilities.
- `git diff --check`: passed.

Live Firebase registration, actual push delivery and PostgreSQL integration suites
were not rerun: Firebase dependencies are unchanged and this task explicitly avoids
account/database/credential changes. In-memory checks are not a new persistence or
live-Firebase verification claim.

## Release recommendation and changed files

Keep production approval **blocked pending upstream remediation or explicit,
documented risk acceptance** for the four installed High findings. A zero-High
policy remains unsatisfied. A narrowly scoped static frontend deployment plus
the independently clean Express production tree has no identified runtime path
to these gRPC advisories; that evidence can support a deployment owner's review,
but does not waive policy or make the audit green.

Changed only:

- `apps/backend/package-lock.json`: compatible body-parser security fix.
- `apps/backend/tests/app.test.ts`: focused parser/notification/FID regressions.
- `apps/frontend/scripts/audit-firebase-bundle.mjs`: reproducible reachability check.
- This report.

Pre-existing uncommitted `apps/frontend/.env.example` edits were preserved.
No UI redesign, new dependency, account write, database migration, credential
change, Git commit or push occurred.
