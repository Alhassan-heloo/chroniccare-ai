# ChronicCare AI — Backend foundation (Task 1A)

This is a separate Node.js + Express + TypeScript package. The frontend remains
unchanged and continues using its existing in-memory demo adapters. There is no
login, patient CRUD, AI, FCM, or patient-data endpoint in this task.

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

Readiness checks **connectivity**, not migration completion. Run `db:migrate`
explicitly before deployment. The HTTP server remains live during a DB outage
so the readiness endpoint can report it; a listening server or successful
liveness check alone does **not** prove database integration. Startup also makes
a real connection attempt and logs only a generic success/unavailable message.
`db:check` and `db:migrate` return a nonzero exit code on failure.

All other routes return JSON 404. Errors use `{ error: { code, message } }`.
Helmet headers, no-store responses, a 32 KB JSON limit, bounded pool/query/socket
timeouts, and an explicit CORS allowlist form the initial security baseline.
Only GET/HEAD/OPTIONS are advertised by CORS in this phase. Requests with a
disallowed Origin receive 403; requests without Origin are allowed. **CORS is
not authentication**. Cookies, authentication, rate limits for sensitive flows,
and authorization policies belong to the relevant future tasks. Do not expose
patient data by adding routes before those protections exist.

`trust proxy` is false. Production deployment must configure trusted proxy hops,
HTTPS termination, and request/rate limits deliberately rather than trusting all
forwarded headers. `NODE_ENV=production` requires `DATABASE_SSL=verify-full`.
Remote TLS uses certificate verification; optionally set `DATABASE_SSL_CA_FILE`
to a trusted PEM CA file. SSL connection-string parameters are rejected so they
cannot override verification settings. Never use `rejectUnauthorized: false`.

## Migration policy

- `migrations/001_backend_foundation.sql` creates the `chroniccare` schema only.
  There are intentionally no premature users, roles, or clinical tables.
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
- Future tables for users, measurements, medications, habit events, alerts,
  and doctor-patient relationships go in the `chroniccare` schema. Their actual
  definitions belong to the tasks that introduce them.
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
Supertest or database emulator is added. DB-up/down application checks inject
a controlled check function and **do not prove a real PostgreSQL connection**.

To enable the real integration test, set `TEST_DATABASE_URL` in `.env` to the
dedicated `chroniccare_test` database, using the same SSL configuration, then run:

```powershell
npm.cmd test
```

The integration test requires a database name ending in `_test` and refuses
existing application tables. It really connects, applies the foundation
migration, checks idempotence and changed checksums, and checks transactional
rollback. It leaves the foundation schema and migration ledger in the dedicated
test database; it never drops an existing application database. Without
`TEST_DATABASE_URL`, this test is explicitly **SKIP**, not PASS. If the variable
is configured but PostgreSQL cannot be reached, the test **fails**.

## Layout and dependencies

```text
apps/backend/
  .env.example
  package.json, package-lock.json
  tsconfig.json, tsconfig.test.json, eslint.config.js
  migrations/001_backend_foundation.sql
  src/
    app.ts, server.ts
    config/env.ts
    db/pool.ts, check.ts, migrations.ts, migrate.ts
    middleware/errors.ts
    routes/index.ts, health.ts
  tests/app.test.ts, env.test.ts, database.test.ts
```

Runtime: Express (HTTP/routing), pg (PostgreSQL pool), Helmet (security headers),
cors (explicit browser-origin policy). Development: TypeScript and type packages,
tsx (development/test execution), ESLint with TypeScript support. No ORM, auth,
AI, Firebase, frontend dependency changes, or root-workspace restructuring.
