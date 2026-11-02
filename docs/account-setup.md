# First Admin and shared sign-in

The existing PostgreSQL accounts, Argon2id password hashing, eight-hour sessions,
role guards, and Doctor–Patient relationship checks are reused. No migration is
needed. Setup uses the same PostgreSQL transaction advisory lock as the trusted
CLI provisioner. The check and insertion share one transaction: only one first
Admin can be created, including across server instances or a competing CLI run.

## Local use

1. Start PostgreSQL. Configure the existing backend `.env` locally, then run
   `npm.cmd run db:migrate` and `npm.cmd run dev` from `apps/backend`.
2. If no Admin exists, the backend console prints a cryptographically random
   one-time setup code. Keep this operator console private.
3. Run `npm.cmd run dev` from `apps/frontend`. Open `/login` and choose
   **First-time Admin setup**, or open `/setup` directly.
4. Enter the code, name, email, and a unique password of 12–128 characters.
   Confirm the password and create the Admin, then sign in through `/login`.
5. Use `/admin/dashboard` to create Doctors. Doctors sign in through `/login`.
   Patients use `/register` and then the same `/login`.

The code is submitted only in the HTTPS request body, never in URLs, frontend
configuration, browser storage, or public API responses. Local development uses
loopback HTTP. Do not publish the local console or use a public HTTP deployment.
After setup, `/api/setup` reports `available: false`, and POST returns 404.
Existing Admin accounts close setup immediately, including after restart.
Ordinary users have no account deletion or role-change endpoint that could reopen
setup. A database operator who deletes every Admin is outside this trust boundary.

## Production

Before the first start, generate a separate high-entropy `BOOTSTRAP_SECRET`
(32–512 characters) in your trusted deployment secret manager. Production refuses
initial setup without it. The server never prints this value in production.
The existing production verified PostgreSQL TLS configuration remains required.
After creating the Admin, remove the configured bootstrap secret and restart.
Never place it in a `VITE_` variable, a URL, source control, or a frontend asset.

Initialization now checks PostgreSQL before opening the listening socket; an
unavailable database or missing migrations causes startup to fail safely. Retry
startup after restoring the database. The generated local code changes on restart
until an Admin exists. A configured production code must be the same on all
instances participating in initial setup.

## Security and boundaries

Setup validates the secret on the server using fixed-size digest comparison,
validates the same strict credential fields as registration, and fixes the role
to Admin. There are no default credentials. Setup allows five failed attempts
per IP per 15 minutes, using the existing in-process rate-limiting dependency.
Multi-instance deployments also need a shared gateway limit, as with login.

Admin Doctor creation grants an account role only; it does not verify a medical
license and creates no patient relationship. Existing migration 007 continues to
restrict access to explicitly assigned patients. Consent and relationship request
management remain separate work. The academic proposal is unavailable locally;
no further approval or license workflow was inferred.

The CLI provisioner remains available to trusted local operators for backward
compatibility. Normal account setup and Doctor creation use the browser.
Logout, expiry, and 401 continue clearing protected React Query caches. Browser
refresh now preserves valid HttpOnly Cookie sessions. See production-account-foundation.md
for the current email invitation, CSRF and session deployment requirements.

## Verification

Use `TEST_DATABASE_URL` ending in `_test`, separate from the application database.
`tests/bootstrap.test.ts` requires no unrelated Admin to exist and deletes only
its own random test accounts. It tests bad secrets, input/role rejection,
concurrent creation, lockout, throttling, expired sessions, and restart behavior.
`npm.cmd run test:admin-integration` from `apps/frontend` runs real browser
bootstrap, Admin/Doctor sign-in, account creation, access isolation, failure
feedback, and restart persistence against the test database.

Verified in this workspace: backend TypeScript, ESLint, build, and 24/24 tests
passed against the separate PostgreSQL test database. Frontend TypeScript,
ESLint, 578-key translation parity, smoke tests, and production build passed.
The focused Edge workflow passed 16 checks with two screenshots in
`apps/frontend/artifacts/admin-foundation/report.json`, including Patient browser
registration/login and protected-cache cleanup after expiry and logout.
Windows sandbox restrictions initially prevented tsx/esbuild from starting;
the same checks passed with approved execution outside the sandbox. Shared
database test files now run sequentially to avoid competing test Admin accounts.
