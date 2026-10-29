# ChronicCare AI — Backend (through Phase 2A / Task 2A.2)

This is a separate Node.js + Express + TypeScript package. Real PostgreSQL-backed
authentication plus authenticated-patient measurement and medication CRUD are
available. Guest measurements and medications remain in frontend demo adapters
and never enter PostgreSQL. Habits, AI, notifications, and doctor/admin clinical
workflows are outside Task 2A.2 and remain unchanged.

## Requirements and Windows setup

- Node.js 22.13+ on the 22.x LTS line, or Node.js 24+ (supported LTS), and npm.
- PostgreSQL, local or remotely accessible. Install the official Windows package
  from https://www.postgresql.org/download/windows/ if needed. Keep the password
  selected during installation private. This task does not install PostgreSQL.
- Run the following commands in **PowerShell**, from the repository directory.
  `npm.cmd` avoids the Windows PowerShell execution-policy restriction on npm.ps1;
  no execution-policy change is necessary.

```powershell
Set-Location C:\Users\msi\Desktop\chroniccare-ai\apps\backend
npm.cmd ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
```

Do not overwrite an existing `.env`. `npm ci` uses the supplied package lock;
`npm install` is only necessary when intentionally changing dependencies.

### Initialize local PostgreSQL

After installing PostgreSQL and starting its Windows service, locate `psql.exe`:

```powershell
Get-Service -Name '*postgres*'
$pgClient = Get-ChildItem 'C:\Program Files\PostgreSQL' -Filter psql.exe -Recurse | Select-Object -First 1 -ExpandProperty FullName
& $pgClient -h localhost -p 5432 -U postgres -d postgres
```

If multiple PostgreSQL versions are installed, select the correct `psql.exe`
explicitly. If PostgreSQL is installed elsewhere, use that installation path.
The last command prompts for the administrative password; do not put it in the
command line. In the **psql prompt**, execute once:

```sql
CREATE ROLE chroniccare_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
\password chroniccare_app
CREATE DATABASE chroniccare OWNER chroniccare_app;
CREATE DATABASE chroniccare_test OWNER chroniccare_app;
\q
```

`\password` prompts for the application password without storing it in shell
history. Do not create a second role/database if it already exists. The test
database is optional and must be dedicated to automated tests. The application
role owns these databases for this foundation; before production, use a separate
migration owner and grant a restricted runtime role only required privileges.

In `.env`, set `DATABASE_URL` with your local application-role password. It has
the form `postgresql://USER:URL_ENCODED_PASSWORD@HOST:5432/DATABASE`.
Replace the `CHANGE_ME` example; percent-encode password characters such as `@`,
`#`, `:`, `/`, and `%`. Never commit `.env` or print its contents in reports.

```powershell
npm.cmd run db:check
npm.cmd run db:migrate
npm.cmd run dev
```

The server defaults to `127.0.0.1:3001`. Keep it bound to loopback for local
development. `HOST=0.0.0.0` allows network access only when intentionally required.
In another PowerShell window:

```powershell
Invoke-RestMethod http://127.0.0.1:3001/api/health
Invoke-RestMethod http://127.0.0.1:3001/api/health/ready
```

Stop the server with **Ctrl+C**. To run compiled output instead:

```powershell
npm.cmd run build
npm.cmd start
```

All npm commands above run from `apps/backend`. Built-in Node environment-file
support loads `.env`; process environment variables take precedence. No dotenv
dependency is necessary. Configuration is validated and invalid configuration
stops startup without logging secrets.

## Endpoints and failure behavior

| Endpoint | Meaning |
| --- | --- |
| `GET /api/health` | Liveness: HTTP application is running; returns 200 regardless of DB availability. |
| `GET /api/health/ready` | Runs a real PostgreSQL `SELECT 1`; 200 when reachable, otherwise 503 with no driver details. |
| `GET /api/measurements` | Lists only the authenticated patient's measurements. |
| `GET /api/measurements/:id` | Gets one owned measurement; another patient's ID returns 404. |
| `POST /api/measurements` | Creates an owned blood-pressure or glucose measurement. |
| `PUT /api/measurements/:id` | Updates one owned measurement while preserving its recorded timestamp. |
| `DELETE /api/measurements/:id` | Deletes one owned measurement and returns 204. |
| `GET /api/medications?date=YYYY-MM-DD` | Lists schedules with dose state for the explicit local calendar date. |
| `GET /api/medications/:id?date=YYYY-MM-DD` | Gets one owned medication and its schedules. |
| `POST /api/medications?date=YYYY-MM-DD` | Creates a medication with one to six unique daily times. |
| `PUT /api/medications/:id?date=YYYY-MM-DD` | Updates text and schedules while preserving unchanged-time dose logs. |
| `DELETE /api/medications/:id` | Deletes one owned medication, schedules, and dose logs. |
| `PUT /api/medications/:id/doses/:time` | Records or undoes one `{ date, taken }` daily dose state. |

Readiness checks **connectivity**, not migration completion. Run `db:migrate`
explicitly before deployment. The HTTP server remains live during a DB outage
so the readiness endpoint can report it; a listening server or successful
liveness check alone does **not** prove database integration. Startup also makes
a real connection attempt and logs only a generic success/unavailable message.
`db:check` and `db:migrate` return a nonzero exit code on failure.

All measurement and medication routes require a live bearer session and the `patient` role.
Unauthenticated requests return 401, non-patient roles return 403, and missing or
not-owned records return the same 404 response. All other routes return JSON 404.
Errors use `{ error: { code, message } }`.
Helmet headers, no-store responses, a 32 KB JSON limit, bounded pool/query/socket
timeouts, and an explicit CORS allowlist form the initial security baseline.
GET/HEAD/POST/PUT/DELETE/OPTIONS and Content-Type/Authorization are advertised by CORS. Requests with a
disallowed Origin receive 403; requests without Origin are allowed. **CORS is
not authentication**. Authentication and role guards are described below;
feature-specific authorization policies belong to their future tasks. Do not expose
patient data by adding routes before those protections exist.

`trust proxy` is false. Production deployment must configure trusted proxy hops,
HTTPS termination, and request/rate limits deliberately rather than trusting all
forwarded headers. `NODE_ENV=production` requires `DATABASE_SSL=verify-full`.
Remote TLS uses certificate verification; optionally set `DATABASE_SSL_CA_FILE`
to a trusted PEM CA file. SSL connection-string parameters are rejected so they
cannot override verification settings. Never use `rejectUnauthorized: false`.

## Migration policy

- `migrations/001_backend_foundation.sql` creates the `chroniccare` schema.
- `migrations/002_authentication.sql` creates users and hashed sessions.
- `migrations/003_patient_measurements.sql` creates the owned measurements table,
  technical value constraints, timestamps, foreign key, and patient/date index.
- `migrations/004_patient_medications.sql` creates patient-owned medications,
  recurring local-time schedules, and date-keyed dose logs with duplicate-proof
  primary keys and cascading schedule cleanup.
- The runner creates `public.chroniccare_schema_migrations`, with version,
  filename, SHA-256 checksum, and application timestamp.
- A PostgreSQL transaction advisory lock serializes concurrent migration runs.
  Pending migrations and their ledger entries commit atomically or roll back.
- A second run does nothing. Changed/missing applied files, duplicate versions,
  or newly inserted older versions are rejected. LF/CRLF differences are ignored
  when calculating checksums, allowing Windows and Linux checkouts to agree.
- Add `002_description.sql`, then `003_description.sql`, etc. Never edit an
  applied migration or include `BEGIN`/`COMMIT` in individual files. Use
  transaction-compatible PostgreSQL DDL; e.g. `CREATE INDEX CONCURRENTLY` is not
  supported by this transactional runner.
- Future tables for habit events, alerts, and doctor-patient
  relationships go in the `chroniccare` schema only in their approved tasks.
- No automatic migrations on HTTP startup and no destructive down/reset command.
  Back up a populated database and review new migration SQL before applying it.
- Build output references the root `migrations/` directory: deploy that directory
  alongside `dist/` and `package.json`/`package-lock.json`.

## Verification

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
git diff --check
```

Tests use Node's built-in test runner and actual loopback HTTP requests; no
Supertest or database emulator is added. The main integration suite connects to
real PostgreSQL when `TEST_DATABASE_URL` is configured; smaller readiness tests
use an injected check and are not a substitute for that suite.

To enable the real integration test, set `TEST_DATABASE_URL` in `.env` to the
dedicated `chroniccare_test` database, using the same SSL configuration, then run:

```powershell
npm.cmd test
```

The integration test requires a database name ending in `_test` and refuses
existing application tables. It really connects, applies all current migrations,
checks idempotence, changed checksums, and rollback, then exercises authentication
plus durable measurement and medication CRUD, schedule/dose-log rules, account
isolation, role rejection, validation, and database constraints. It leaves the
schema and migration ledger in the
dedicated test database; it never drops an existing application database. Without
`TEST_DATABASE_URL`, this test is explicitly **SKIP**, not PASS. If the variable
is configured but PostgreSQL cannot be reached, the test **fails**.

## Layout and dependencies

```text
apps/backend/
  .env.example
  package.json, package-lock.json
  tsconfig.json, tsconfig.test.json, eslint.config.js
  migrations/001_backend_foundation.sql, 002_authentication.sql,
             003_patient_measurements.sql, 004_patient_medications.sql
  src/
    app.ts, server.ts
    auth/store.ts, security.ts, middleware.ts, provision.ts
    measurements/store.ts, validation.ts
    medications/store.ts, validation.ts
    config/env.ts
    db/pool.ts, check.ts, migrations.ts, migrate.ts
    middleware/errors.ts
    routes/index.ts, health.ts, auth.ts, measurements.ts, medications.ts
  tests/app.test.ts, env.test.ts, database.test.ts, auth.test.ts,
        measurements.test.ts, medications.test.ts
```

Runtime: Express (HTTP/routing), pg (PostgreSQL pool), Helmet (security headers),
cors (explicit browser-origin policy), argon2 (password hashing), and
express-rate-limit (bounded authentication attempts). Development: TypeScript and type packages,
tsx (development/test execution), ESLint with TypeScript support. No ORM,
AI, Firebase, frontend dependency changes, or root-workspace restructuring.

## Phase 2A / Task 2A.1: patient measurements

The measurement API accepts exact JSON objects; unknown or unit fields are
rejected. Blood pressure uses integer `systolic` and `diastolic` values in mmHg.
Glucose uses a positive numeric `value` in mg/dL. Create may include `recordedAt`
as an ISO-8601 timestamp with a timezone offset and millisecond precision; when
omitted, PostgreSQL records the server time. Updates preserve it. The server owns
`id`, `patientId`, `createdAt`, `updatedAt`,
and `isExample` (always false for PostgreSQL rows).

```json
{ "kind": "bloodPressure", "systolic": 135, "diastolic": 85, "recordedAt": "2026-10-29T09:30:00.000Z" }
{ "kind": "glucose", "value": 99.25, "recordedAt": "2026-10-29T09:30:00.000Z" }
```

Every query includes the authenticated user's ID. IDs owned by another patient
are deliberately indistinguishable from missing IDs. SQL values are always
parameterized, while database checks duplicate the API's core invariants as a
last line of defense. Technical acceptance bounds are not medical diagnoses and
the API does not generate labels such as “normal”.

From `apps/frontend`, `npm.cmd run test:measurements-integration` runs Edge, Vite,
the compiled Express server, and the dedicated PostgreSQL test database. Set
`PLAYWRIGHT_MODULE_PATH` when Playwright is supplied outside this repository.
The script refuses a database whose name does not end in `_test`, also refuses
the application database URL, uses unique temporary patients, and cleans them up.

## Phase 2A / Task 2A.2: patient medications

Medication JSON contains trimmed `name` (2–100 characters), `dosage` (1–100),
optional `notes` (up to 400), and one to six unique `HH:MM` daily times. These
are user-entered records only; the API does not prescribe or recommend anything.

Recurring schedule times are stored as `time without time zone`. Daily dose
identity is the composite `(medication_id, scheduled_time, taken_on)`, where
`taken_on` is an explicit `YYYY-MM-DD` date from the patient's device. This
avoids converting a local calendar day through UTC and prevents duplicate logs.
Recording an already-recorded dose and undoing an absent log are both idempotent.

Schedule updates run in a transaction. An unchanged time retains all its dose
logs, a removed time cascades its logs, and a new time starts unrecorded. Every
lookup and mutation is scoped to the authenticated patient in SQL; ownership is
never accepted from request JSON.

From `apps/frontend`, `npm.cmd run test:medications-integration` runs responsive
Edge workflows against the compiled Express server and the dedicated PostgreSQL
test database. It verifies CRUD, daily dose state, schedule editing, persistence,
isolation, Dashboard/Reports synchronization, demo separation, API failures,
RTL/LTR, themes, Motion Off, and reduced-motion behavior.

## Task 1B: Authentication and authorization

Apply the new versioned migration (do not edit `001` or reset the database):

```powershell
Set-Location C:\Users\msi\Desktop\chroniccare-ai\apps\backend
npm.cmd ci
npm.cmd run db:check
npm.cmd run db:migrate
npm.cmd run dev
```

`002_authentication.sql` adds `chroniccare.users` and `chroniccare.sessions`,
with UUID account IDs, unique lowercase emails, Argon2id password hashes,
constrained patient/doctor/admin roles, timestamps, expiring session hashes,
foreign keys, and session indexes. Existing application data is not changed.

### API contract

| Endpoint | Request / authorization | Success |
| --- | --- | --- |
| POST `/api/auth/register` | JSON `{ "name": "Demo", "email": "demo@example.test", "password": "a-long-unique-password" }` | 201 `{ user }`, patient only; does not log in automatically |
| POST `/api/auth/login` | JSON `{ email, password }` | 200 `{ user, token, expiresAt }` |
| GET `/api/auth/me` | `Authorization: Bearer <token>` | 200 `{ user }` |
| POST `/api/auth/logout` | Same bearer header | 204, current session deleted |

User objects contain **only** `id`, `name`, `email`, `role`. Passwords/hashes are
never returned. Inputs reject unknown properties (including role/id/isAdmin).
Name: trimmed 1–100 characters. Email: trimmed, lowercase, basic email shape,
up to 254 characters. Password: 12–128 characters, never trimmed or normalized.
Invalid input: 400 `INVALID_INPUT`; duplicate email: 409 `ACCOUNT_EXISTS`;
wrong/unknown credentials: same 401 `INVALID_CREDENTIALS`; missing, revoked,
malformed, expired tokens: 401 `UNAUTHENTICATED`; wrong role: 403 `FORBIDDEN`.
Duplicate registration discloses account existence; no other account details
are exposed. This deliberate behavior supports a straightforward sign-up flow.

Passwords use Argon2id (19 MiB, two iterations, one lane, random per-hash salt).
Session tokens use 32 cryptographically random bytes. Only SHA-256 digests are
stored; tokens expire after eight hours, with no sliding refresh. Login creates
a new independent session. Logout revokes that session immediately server-side;
other devices remain logged in. Expired rows do not authenticate; operators can
periodically execute `DELETE FROM chroniccare.sessions WHERE expires_at <= now()`
to reclaim storage. No plaintext token or authentication signing secret is stored
in configuration. Never log Authorization headers or login response bodies.

For future React integration, send the bearer header explicitly, keep the token
in memory (not localStorage/URLs), and clear it on logout/401. Reload requires
login again. This task adds no browser persistence or UI. Cookies are not used,
so no ambient-cookie CSRF flow is introduced. CORS credentials remain disabled;
CORS is not authorization. Use HTTPS for all non-loopback deployments.

`requireAuth(store)` resolves a live session and current account from PostgreSQL
on every request. Follow it with `requireRoles("patient")`, `requireRoles("doctor")`,
or `requireRoles("admin")` (explicit allowlists, no implicit admin bypass). Guards
are tested using test-only routes; no artificial role/data endpoints are exposed.
There is no role-update endpoint. Role changes require a later reviewed workflow.

### Initial administrator and doctor provisioning (local operator only)

Public registration never accepts a role and always creates a patient. Doctors
are created by a trusted operator after offline identity verification; self-
declared doctor registration is deliberately not permitted. This avoids granting
clinical privileges to an unverified user. No doctor approval workflow is added.

Provisioning requires local shell access and database credentials. It only inserts
new accounts; it never changes an existing account or password. Initial admin
creation is serialized using a transaction lock and refuses if any admin exists.
No default admin credentials are supplied or created automatically.

Run in a private PowerShell terminal (not in chat, scripts committed to Git, or
command arguments). `Read-Host -AsSecureString` masks the password. The plaintext
exists briefly in this shell's process environment for the child command, and is
removed in `finally`; do not use `setx`, print the environment, or save the value
in `.env`. Use a unique password of 12–128 characters.

```powershell
$accountPassword = Read-Host 'New account password' -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($accountPassword)
try {
  $env:AUTH_PROVISION_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  npm.cmd run auth:provision -- admin admin@example.test 'Initial Admin'
  # To provision a verified doctor instead, replace the preceding command with:
  # npm.cmd run auth:provision -- doctor doctor@example.test 'Verified Doctor'
} finally {
  Remove-Item Env:AUTH_PROVISION_PASSWORD -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  $accountPassword.Dispose()
}
```

Replace the example email/name locally. Do not run both commands with one
password. The provisioner reports generic failures only, including duplicate
email, existing admin, invalid inputs, connectivity, or missing migrations.

### Verification and deployment boundaries

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
git diff --check
```

Authentication regression tests run real HTTP requests with an in-memory store
and the real password hashing library. With `TEST_DATABASE_URL` pointing at a
separate database ending in `_test`, the same scenario also runs against real
PostgreSQL, with unique accounts inside a transaction rolled back at the end.
Migration-owned tables/ledger remain in that dedicated test database. Migration
tests reject unknown tables. Never point tests at the application database.
Without a test database the PostgreSQL integration tests explicitly skip.

Login and registration share a per-process/IP limit of 20 requests per 15 minutes,
including validation failures (429 `RATE_LIMITED`). `trust proxy` remains false:
configure trusted proxy hops and a shared/edge rate limit before deploying behind
a proxy or using multiple instances. A restart resets the in-memory limiter.
Production also requires HTTPS, backups, least-privilege DB access, log redaction,
and secret management. Email verification, password reset/change, MFA, session
management UI, and role administration are not implemented in Task 1B. Do not
treat the current foundation as a complete production identity platform.
