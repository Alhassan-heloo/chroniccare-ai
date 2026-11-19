# Same-origin deployment on the existing Render Web Service

Target: **https://chroniccare-ai-api.onrender.com**. The same Express process
serves the production React build at `/` and keeps the API at `/api`.
No database, migration, session, CSRF, role or Render proxy-trust policy changes
are part of this deployment change.

## Exact Render settings

Keep the existing Web Service; do not create a separate Static Site.

**Root Directory:** leave blank (repository root). Both `apps/backend` and
`apps/frontend` must be available. Render excludes files outside a configured
root directory at build time and runtime, so `apps/backend` cannot remain the
service root. See [Render monorepo support](https://render.com/docs/monorepo-support).
If build filters exist, include changes under both apps.

**Build Command**, relative to repository root:

```sh
npm --prefix apps/backend ci --include=dev && npm --prefix apps/frontend ci --include=dev && npm --prefix apps/frontend run build && npm --prefix apps/backend run build
```

Explicitly installing development dependencies keeps TypeScript/Vite available
when Render sets `NODE_ENV=production`.

**Start Command:**

```sh
npm --prefix apps/backend start
```

**Health Check Path:** keep `/api/health/ready`.

Set these backend Web Service environment values before building:

```text
NODE_ENV=production
HOST=0.0.0.0
VITE_API_URL=/api
APP_PUBLIC_ORIGIN=https://chroniccare-ai-api.onrender.com
CORS_ORIGINS=https://chroniccare-ai-api.onrender.com
```

Keep Render's assigned `PORT`, the existing `TRUST_RENDER_PROXY=true` setting
and its documented [trust assumptions](render-ingress.md). Do not combine that
option with `TRUST_PROXY_IP`. Existing exact-IP deployments still use the latter.
Keep `DATABASE_URL`, `DATABASE_SSL=verify-full`, any database CA, first-admin,
email, assistant and FCM credentials/settings unchanged. Retain the existing
public `VITE_FIREBASE_*` configuration if browser push is already configured;
never put server secrets in any `VITE_*` variable.

`VITE_API_URL` is baked into the frontend by Vite. Changing only the running
service's environment does not rewrite old JavaScript: rebuild/redeploy after
changing this value. See [Vite environment loading](https://vite.dev/guide/env-and-mode).

Do not introduce a new migration step for this change. If the existing service
already has a Pre-Deploy Command that runs migrations, retain that workflow and
adjust its working-directory prefix for the new repository root, for example:

```sh
npm --prefix apps/backend run db:migrate
```

No Render setting was changed and nothing was deployed by this local task.

## What is served

Actual Vite output is **`apps/frontend/dist/index.html`**, hashed JS/CSS/images
under `dist/assets`, and copied public files such as `favicon.svg`,
`appearance-init.js`, fonts and `cc-fcm/sw.js`.

In production, `server.ts` resolves that exact sibling build directory relative
to its module, independent of the launch working directory. A missing built
index fails startup before opening a database pool. It never falls back to
serving the repository, frontend source directory or Vite development server.

Express handles all `/api` requests first, including JSON404s for unknown paths.
Existing readiness keeps its database check and200/503 results and the exact
internal HTTP GET exception. After the API, Express serves existing built files.
HTML GET/HEAD requests to extensionless React routes return the built index, so
direct visits and refreshes such as `/patient/dashboard` work. Missing assets,
reserved source/private namespaces, dot paths and non-HTML/non-read requests do
not receive the SPA shell. The security middleware still runs before HTML and
assets, so production application traffic still requires HTTPS.

The existing locale/theme bootstrap is now an external local file with the same
logic and execution order. Helmet retains `script-src 'self'`; no inline-script
exception is added. The UI-only CSP allows the existing Firebase installation
and messaging registration origins, confirmed in the installed SDK:
`https://firebaseinstallations.googleapis.com` and
`https://fcmregistrations.googleapis.com`. API responses retain their original
Helmet policy. No design, Firebase permission flow or backend push worker changed.
The client entry configures the installed Zod library's supported `jitless` mode
before constructing application schemas. This disables optional code generation,
not validation, and avoids its otherwise caught `eval` probe under strict CSP.
See [Zod CSP guidance](https://zod.dev/compile#content-security-policy).

## Every API URL consumer

`src/lib/api/baseUrl.ts` is now the only production-code consumer of
`VITE_API_URL`. Its value is shared by:

1. `src/auth/api.ts`: credentialed auth and all role-scoped API requests.
2. `src/lib/api/client.ts`: the existing Axios client.
3. `src/lib/notifications/browser.ts`: the push worker configuration.

An explicit override is honored and its trailing slash normalized. Without an
override, production defaults to `/api`; Vite development retains the existing
`http://localhost:3001/api` default. Local `.env` files and integration scripts
that supply another loopback port continue working. The push worker receives an
absolute URL resolved against `location.origin`, because its existing receipt
handler calls `new URL(api)` and cannot consume a bare `/api` parameter.

Secure, HttpOnly, host-only `__Host-` session/CSRF cookies and SameSite=Lax stay
unchanged. Browser writes still require the allowed same origin and a matching
CSRF header. API role checks remain server-side; refreshing React never grants
access by itself.

## Local verification

Run builds from repository root:

```sh
npm --prefix apps/frontend run build
npm --prefix apps/backend run typecheck
npm --prefix apps/backend run build
```

Supply `VITE_API_URL=/api` in the build environment, especially if a developer's
local Vite `.env` contains a separate API URL.

Focused checks:

```sh
node --import tsx --test tests/frontend.test.ts tests/render-ingress.test.ts tests/app.test.ts
```

Run that command from `apps/backend`. From `apps/frontend`, run
`npm run test:api-base` and `npm run test:smoke`.

`npm run test:same-origin` uses the existing `final-postgres.mjs` wrapper to
create a fresh owned loopback PostgreSQL database, real auth/patient stores,
the built frontend and a local TLS ingress that overwrites forwarding headers.
It requires the available Playwright/Edge and OpenSSL; this environment supplies
them through `PLAYWRIGHT_MODULE_PATH` and `OPENSSL_BINARY`. Only that isolated
test browser accepts the generated self-signed certificate. Production TLS and
database verification settings are never relaxed.

The rehearsal signs in with a synthetic patient, checks real Secure cookie flags,
refreshes the dashboard and measurement deep link, matches the stored reading and
timestamp, checks role/CSRF/CORS rejection, API JSON404s, source/asset isolation,
readiness and CSP. No real email/FCM calls or production-account writes are made.
Evidence remains ignored locally under `apps/frontend/artifacts/same-origin`.

Actual local results for this change:

- Backend typecheck, build and lint passed. Focused routing/transport tests:
  **21/21**. Complete backend regression suite: **86/86**, zero skips, using a
  separate newly created owned PostgreSQL test database.
- Frontend build, typecheck, API-consumer checks (four environment cases) and
  existing smoke tests passed. Lint has no errors and the one existing
  `ExampleRecord.tsx` Fast Refresh warning. Existing bundle-size/Zod annotation
  build warnings remain; they do not prevent the build.
- Real Edge rehearsal: **8/8** groups passed, including same-origin login and
  patient dashboard refresh with PostgreSQL-backed session/measurement data.
  The browser retained the `__Host-cc_session` Secure/HttpOnly/SameSite=Lax cookie;
  all API calls used the same HTTPS origin. No CSP/runtime violation remained.
- Production output contains the external appearance bootstrap and compiled
  hashed assets. No Vite source entry is served. All temporary TLS credentials
  and test listeners were cleaned up; production accounts/data were untouched.

Before editing, public readiness returned200; the public `/` request timed out
within the local15-second observation window. These observations are not a claim
that the new frontend is live. Changes remain local until the operator deploys.
