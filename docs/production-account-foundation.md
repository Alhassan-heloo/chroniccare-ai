# Account and authentication foundation

The existing PostgreSQL users, Argon2id policy, session hashes, role guards,
Admin Doctor creation, Patient CRUD and Doctor–Patient relationship checks are
reused. No patient health data or role is rewritten. Migration
`009_account_authentication.sql` adds session activity timestamps and hashed,
expiring, single-use account tokens. Earlier migrations are unchanged.

## Operator installation: first Admin invitation

Configure these **backend-only** deployment values through a secret manager:

| Setting | Meaning |
| --- | --- |
| `APP_PUBLIC_ORIGIN` | Exact frontend origin, e.g. `https://clinic.example`, without a trailing slash |
| `FIRST_ADMIN_EMAIL` | First Admin address pre-authorized by the trusted installer |
| `EMAIL_PROVIDER` | `resend` |
| `EMAIL_API_KEY` | Restricted Resend API key; never a frontend variable |
| `EMAIL_FROM` | Sender on a domain authorized by your email provider |
| `CORS_ORIGINS` | Explicit trusted frontend HTTPS origins |
| `TRUST_PROXY_IP` | Optional exact IP of the trusted TLS proxy; backend must not be publicly bypassable |
| `TRUST_RENDER_PROXY` | Optional `true` for Render Web Service's single ingress hop; mutually exclusive with `TRUST_PROXY_IP`. See [trust boundary](render-ingress.md) |

Production continues requiring verified PostgreSQL TLS. HTTP application origins
and insecure forwarded requests are refused in production. Use a TLS reverse
proxy with its exact IP (or the documented Render opt-in), block untrusted direct
backend access, and configure CORS to contain
the public application origin. Render's optional one-hop setting and the exact
read-only HTTP readiness exception are documented in [Render ingress](render-ingress.md).
Frontend `VITE_API_URL` must use the same site
(ideally `https://clinic.example/api`). Do not mix localhost and 127.0.0.1 in local
frontend/API configuration. SameSite=Lax deliberately does not support unrelated
cross-site frontend/API installations.

After reviewing and applying migrations, the trusted installer runs from
`apps/backend`:

```powershell
npm.cmd run db:check
npm.cmd run db:migrate
npm.cmd run auth:invite-admin
npm.cmd run dev
```

For deployment use `npm.cmd run build` followed by `npm.cmd start` instead of dev.
The invitation command accepts no arbitrary recipient argument or password.
It reads only the pre-authorized address and sends a twenty-minute activation
link. The clinic Admin opens the email, enters a name and password, and signs in
normally. No public API can issue Admin invitations. Existing Admin accounts
prevent issuance and activation. An atomic lock shared with the original
bootstrap/provisioner ensures there can be only one initial Admin.

The existing `/setup` code mechanism remains available until deployment testing
approves retiring it. In production it is enabled only by an independently trusted
`BOOTSTRAP_SECRET`; when FIRST_ADMIN_EMAIL is configured it may be omitted to
leave email activation as the only browser onboarding path. Existing Admin
accounts close both paths. The compatibility CLI remains trusted-operator-only.

Email uses the documented [Resend Send Email HTTP API](https://resend.com/docs/api-reference/emails/send-email)
without an SDK. The transport interface can be adapted for another provider.
No configured provider means reset requests return `EMAIL_UNAVAILABLE` and the
invitation command fails; no message is claimed as sent. Provider acknowledgement
does not prove inbox delivery. Verify sender authorization, DNS, spam placement
and real delivery with the clinic's chosen provider before deploying. Disable
tracking/URL rewriting on security emails where possible.

## Clinic daily browser use

All roles use `/login`. Patients register themselves at `/register`. Admin
invites Doctors from the Admin dashboard; Doctors activate through emailed links
and choose their own passwords. See [Doctor invitations](doctor-invitations.md)
for migration 014, delivery requirements and the changed creation API. The original
account-foundation implementation used initial passwords for Doctors; only Admin
activation was email-based at that time. Doctors and Patients connect through
the existing code/review/approval flow; revocation blocks subsequent server reads.
Admin receives no access to patient clinical records.

Refreshing or restarting the backend preserves a valid browser session because
the browser sends an HttpOnly Cookie and PostgreSQL retains its hash. Credentials
are never stored in localStorage. Production Cookies use Secure, HttpOnly,
SameSite=Lax, a host-only `__Host-` name and Path=/. Local loopback development
uses non-Secure cookies with a separate name. Browser login responses omit the
session token. Existing non-browser Bearer clients remain compatible only without
an Origin; they have no ambient Cookie authentication and receive the same expiry
and role checks. Never put those credentials in frontend code or browser storage.

Browser mutations, including login/register, require an allowed Origin and a CSRF
header matching a separate HttpOnly cookie. The frontend obtains that header
through `/api/auth/csrf`; it is not an authentication credential. Invalid CSRF
requests are rejected before mutation. The client refreshes CSRF once only on an
explicit CSRF rejection; it never retries an uncertain network write automatically.

The server enforces thirty minutes without authenticated requests for Patient and
Doctor sessions, fifteen for Admin, plus absolute limits of eight/four hours
respectively. Protected background data requests count as activity; the standalone
authentication keepalive was removed. Login rotates/revokes the prior browser
session. Logout deletes the database session and clears the Cookie. Other-device
sessions remain valid until logout, expiry or password reset. Failed/offline logout
clears local protected UI but cannot guarantee server revocation; the UI warns
and the operator/user should reconnect and sign out before leaving a shared device.

React Query is cleared on logout, expiry and account switching. BroadcastChannel
signals same-browser tabs to recheck identity. Protected API responses identify
the authenticated account; a late response from a switched Cookie session is
rejected before committing data to the previous account's query cache.

## Forgot/reset password

Use `/forgot-password`. Eligible accounts receive a twenty-minute, single-use
link. Known and unknown emails receive the same generic acknowledgement, which
does not assert delivery. Provider failures are reported privately without account
or credential contents. Retry after checking the email service if no message
arrives. Delivery is synchronous for eligible requests, so response timing may
differ; asynchronous durable email delivery is a future hardening step.

Links contain a random secret in a URL fragment, never an API query parameter.
The frontend immediately removes the fragment from history and keeps the token
only in memory until explicit form submission. GET/scanners do not consume it.
If you refresh before submitting, reopen the email link. Tokens are stored only
as hashes. Expired/consumed/wrong-purpose tokens fail generically. Reset changes
the Argon2id hash, consumes sibling reset tokens and revokes all sessions in the
same transaction. Login checks its credential hash again under the account lock
to prevent a pre-reset credential establishing a later session.

## Security limits and manual review

Login has per-IP and per-normalized-account throttling. Account-link routes are
also throttled; email issue attempts coalesce for two minutes. Limits are
per-process and need a shared gateway/store for multiple instances. Account
throttling can temporarily delay a legitimate user under attack. Admin sessions
have shorter expiry, but MFA, recovery codes, audit/security-event monitoring,
breached-password checks and privileged-action reauthentication are not
implemented. A real deployment needs a separately reviewed plan for these.

Delivery and a database commit are not one distributed transaction; a crash can
leave a delivered link invalid. The operator/user can request a replacement.
Provider acceptance, real inbox delivery, production TLS/proxy configuration,
backups, secret rotation and abuse monitoring still require deployment verification.
Passing tests does not establish production readiness.

## Tests

Use a separate `TEST_DATABASE_URL` ending in `_test`. Only this database is
migrated by integration tests. Do not use the application/production database.
Run `npm.cmd test` from `apps/backend` and `npm.cmd run test:account-foundation`
from `apps/frontend`. The browser test runs real Express/PostgreSQL/Edge with an
explicitly injected test email capture, not a production fallback. It exercises
Admin activation and Doctor creation, all roles, persistent Cookies, health page
loading, consent/revocation, password reset, expiry, logout and cache clearing.
Its results are in `apps/frontend/artifacts/account-foundation/report.json`.

Old browser scripts that assert refresh must log out are historical tests and
must not be treated as current session specifications. The focused account test
replaces that assertion. Existing backend Patient/Doctor regressions continue
covering their data APIs, calculations and ownership boundaries.

Actual results in this workspace: backend TypeScript/ESLint/build passed;
28/28 backend tests passed without skips. Three focused account/transport/Cookie
tests passed again after the final absolute-expiry and CSRF refinements.
Frontend TypeScript/ESLint, smoke tests, 610-key translation parity and production
build passed (2444 modules). Edge passed 21 checks, including same-context
cross-tab logout/account switching and protected-cache clearing. The Arabic light
mobile screenshot was visually inspected. `git diff --check` passed. No live
email provider credentials, inbox delivery or production TLS deployment were
tested; email capture and provider acknowledgement mocks are labelled as tests.

## Changed-file map for this task

- Backend migration: `migrations/009_account_authentication.sql`.
- Existing backend modules: `src/app.ts`, `src/server.ts`, `src/auth/store.ts`,
  `src/auth/middleware.ts`, `src/routes/auth.ts`.
- New backend modules: `src/auth/accounts.ts`, `src/auth/cookies.ts`,
  `src/auth/email.ts`, `src/auth/invite.ts`, `src/routes/accounts.ts`.
- Backend tests: new `tests/account-foundation.test.ts`, updated
  `tests/app.test.ts` and `tests/database.test.ts`.
- Backend configuration/docs: `.env.example`, `package.json`, `README.md`.
- Frontend auth: `src/auth/api.ts`, `AuthProvider.tsx`, `context.ts`,
  `RouteAccess.tsx`; `src/pages/auth/AuthPage.tsx` and new `AccountEmailPage.tsx`.
- Frontend routes/translations: `src/app/routes.tsx`, `src/i18n/locales/ar.ts`
  and `en.ts`.
- Frontend verification: `scripts/smoke.tsx`, new
  `scripts/account-foundation-browser.mjs`, and `package.json`.
- Documentation: this guide and updated session notes in `account-setup.md`
  and `patient-connections.md`.

Existing uncommitted work from earlier phases was preserved. No commit/push was
performed. Apply migration 009 to the application database only after manual
review and the normal deployment backup/configuration checks.
