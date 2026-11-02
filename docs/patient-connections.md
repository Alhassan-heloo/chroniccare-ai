# Doctor–Patient connections

The existing single-clinic authentication, role guards, Admin Doctor creation,
read-only Doctor API and migration 007 authorization boundary are reused.
Admin receives no clinical-record access. No diagnosis or licensure verification
is inferred. No new dependency or login mechanism is introduced.

## Migration and deployment

`008_patient_connections.sql` adds nullable `patient_approved_at` to existing
relationships and creates `doctor_connection_codes`. Existing relationships keep
their access and remain labelled operator-managed, with no recorded patient
approval. Existing health records and account roles are untouched. A patient can
explicitly approve an existing relationship or revoke it.

Only the separate test database was migrated during implementation. Before using
the new code with the local application database, review the migration, confirm
the backend `.env` points to the intended database, and run from `apps/backend`:

```powershell
npm.cmd run db:check
npm.cmd run db:migrate
npm.cmd run dev
```

Start the frontend with `npm.cmd run dev` from `apps/frontend`.

## Browser workflow

1. Admin creates Doctor accounts using the existing Admin dashboard.
2. Doctor signs in, opens **Connect Patient**, and generates a code.
3. Doctor privately shares the code with exactly one patient.
4. Patient signs in and opens **My Doctors** (mobile: **More**).
5. Patient enters the code and selects **Review Doctor**. The name/email are
   supplied by the server. This operation grants no access.
6. Patient reads the access explanation and selects **Approve connection**.
7. Doctor opens Patients and can read only authorized records.
8. Patient selects **Revoke access** in My Doctors. Subsequent record requests
   immediately fail their existing server-side relationship check.

All three roles use the existing shared Login. Valid sessions now survive refresh
through HttpOnly Cookies (see production-account-foundation.md). Connected accounts and permissions
persist in PostgreSQL, including across backend restarts.

## API

| Endpoint | Role | Effect |
| --- | --- | --- |
| POST `/api/connections/codes` | Doctor | Generate `{code, expiresAt}` for the authenticated Doctor |
| POST `/api/connections/preview` | Patient | Review server identity using `{code}` |
| POST `/api/connections/approve` | Patient | Explicitly approve `{code}` for the authenticated Patient |
| GET `/api/connections/doctors` | Patient | List own doctors and recorded approval provenance |
| DELETE `/api/connections/doctors/:doctorId` | Patient | Revoke own relationship only |

Codes contain 192 random bits, expire after ten minutes, and are shown only when
generated. PostgreSQL stores only their SHA-256 hashes, Doctor identity, expiry,
and consumption timestamp. Codes are never put in URLs or browser storage.
Preview and approval require Patient authentication. Request bodies cannot choose
the Patient or role. Invalid, expired and consumed codes share the same response.
All SQL is parameterized.

Confirmation consumes the code and inserts/updates the relationship atomically.
A row lock prevents two patients consuming the same code. A transaction advisory
lock serializes relationship changes per patient; unique relationship keys prevent
duplicates. A repeated confirmation cannot reuse the code. If a response is lost,
refresh My Doctors to verify the committed outcome before retrying. Mutations do
not automatically retry or announce success before the server responds.

Generation, preview and approval each allow 20 requests per IP per 15 minutes.
These baseline limits are per process; multi-instance production needs shared
gateway limits. Use HTTPS outside loopback. Share codes privately: another signed-in
patient possessing a code can approve it first; no patient identity is preassigned.

## Limitations

There is no push notification channel. Doctor lists and records refresh on focus
and every 15 seconds while visible; information already delivered cannot be
recalled. Revocation blocks every subsequent server request. Expired/generated
code hashes remain stored for now; an operator may later define a retention policy.
No consent document upload, medical license check, or relationship request system
is added. The original academic proposal remains unavailable in this workspace.

## Verification

Backend integration uses PostgreSQL with one Admin, two Doctors and two Patients,
including expiry, concurrent approval, duplicates, legacy compatibility,
role rejection, isolation, revocation, logout and restart. Run `npm.cmd test` from
`apps/backend`. The dedicated database must end in `_test`; test cleanup targets
only random accounts created by the test.

From `apps/frontend`, `npm.cmd run test:connections-integration` runs Edge with
the real backend and test database. Artifacts are under
`apps/frontend/artifacts/patient-connections`. The test covers both pairs,
preview without access, approval, expiry/reuse, refresh, direct URLs, revocation,
logout/login, keyboard use, Arabic/English, light/dark and responsive widths.

Actual verification: backend TypeScript, ESLint and build passed; the complete
PostgreSQL/backend suite passed 25/25 with no skipped tests. The focused connection
test passed again after adding the per-patient transaction lock. Frontend
TypeScript, ESLint, smoke tests, 599-key translation parity and production build
passed (2443 modules). Edge passed 17 workflow checks with no page errors, including
1440/768/390/320px widths. The Arabic light-mode 320px screenshot is in the same
artifact folder. Existing Patient CRUD/report calculations and Doctor relationship
authorization were covered by the backend regressions and frontend smoke checks.
