# Task 1C — Frontend authentication

The existing backend must have migrations 001 and 002 applied. Start it from
`apps/backend` with `npm.cmd run dev`. Start this frontend from `apps/frontend`
with `npm.cmd run dev` (normally http://localhost:5173).

Production defaults to same-origin `/api`; development defaults to http://localhost:3001/api. Set `VITE_API_URL` in a local Vite
environment file or the frontend process environment to override it. This is a
public API address, **not** a place for database credentials or secrets. Backend
`CORS_ORIGINS` must explicitly allow the frontend's actual origin. Use HTTPS for
both services outside loopback development.

## Behavior and boundaries

- Public sign-up accepts only name/email/password and creates patients. No public
  doctor/admin selector exists. Provision those accounts through the documented
  backend operator command, never through frontend controls.
- Login obtains a bearer session and verifies it using `/auth/me`. The token is
  held only in React memory: no localStorage, sessionStorage, cookies, or URL.
  Reload/new tab requires another login. Language and theme preferences still
  persist independently.
- Roles select the appropriate landing page and guarded routes. Wrong-role
  navigation redirects to the user's own dashboard. The server remains the
  authority for authorization; frontend guards are not a security boundary.
- Session expiry is handled locally using the backend expiry timestamp and by
  checking `/auth/me` on window focus and every minute. Network failure alone
  does not mark the session expired; a backend 401 does.
- Logout revokes the current backend session and clears local auth state and
  React Query caches. If revocation cannot be confirmed, local state is still
  cleared and a warning explains that the server session may survive until expiry.
- Account transitions cancel queries and clear query/mutation caches. Existing
  health data adapters remain **in-memory demo adapters**, not patient records.
  Authentication does not persist health measurements to PostgreSQL in this task.
- The explicit demo entry remains available without an account, only for patient
  demo routes. It creates no server session and cannot grant doctor/admin access.
- The original route, query and hash can be restored after login, restricted to
  the authenticated role's path prefix to prevent external or wrong-role redirects.

## Verification

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run check
npm.cmd run build
```

Real-browser regression requires an installed Playwright and Microsoft Edge,
the backend dependencies and compiled `apps/backend/dist`, and a migrated,
dedicated `chroniccare_test` configured in backend `.env` as `TEST_DATABASE_URL`.
No new browser dependency is installed. If Playwright is not locally resolvable,
set `PLAYWRIGHT_MODULE_PATH` to its existing absolute module path, then run:

```powershell
npm.cmd run test:auth-browser
```

The script refuses any test database name other than `chroniccare_test`, starts
temporary backend/frontend services on loopback ports 3302/5176 (refuses occupied
ports), and directs the backend only at that test database. It checks real UI
registration/login/logout, duplicate/invalid inputs, role guards, token storage,
cache clearing, revocation, demo entry, locale switching, and responsive auth pages.
It deletes only its own randomly named test accounts, stops its services, and
writes screenshots and a sanitized report under `artifacts/auth`. No browser trace
or credential-bearing network logs are written. Doctor/admin test accounts are
created directly in the dedicated test database, never by public registration.

The older broad responsive script predates protected routes and requires an
explicit demo/auth session to inspect patient pages; it is not a replacement for
this focused authentication verification.
