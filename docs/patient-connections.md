# Doctor–Patient connections

The existing single-clinic authentication, role guards, Admin Doctor creation,
read-only Doctor API and migration 007 authorization boundary are reused.
Admin receives no clinical-record access. No diagnosis or licensure verification
is inferred. No new dependency or login mechanism is introduced.

## Migration and deployment

`008_patient_connections.sql` adds nullable `patient_approved_at` to existing
relationships and creates `doctor_connection_codes`. Doctor access requires a
recorded patient approval. Existing relationships without approval remain visible
to the patient as awaiting approval and are excluded from the Doctor's accessible
patients. Explicit approval through a code or invitation updates the existing
relationship. The authorization change needs no schema or data migration.

For initial local setup on a database that is missing existing migrations,
review the migrations, confirm the backend `.env` points to the intended local
database, and run from `apps/backend`:

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
8. Patient selects **Revoke access** in My Doctors. The database orders revocation
   against any authorized record or activity read in progress. Reads that acquire
   authorization after revocation commits fail the relationship check.

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

## Targeted patient invitations

A Doctor issues a ten-minute link with `POST /api/connections/invitations` and
`{email}`. The patient identity is assigned by the server, and the link carries
the opaque token in its fragment. PostgreSQL stores the token hash. Preview
requires the intended signed-in Patient and grants no access. **Close review**
only dismisses the screen. It sends no decision and leaves the link available
while eligible.

**Reject invitation** requires confirmation and submits only `{token}` to
`POST /api/connections/invitations/reject`. Approval and rejection share the
same patient advisory lock, invitation row lock, account checks and expiration
checks. Both consume the token in that transaction. Approval records consent.
Rejection marks the token rejected without touching the relationship. Patients
can revoke previously granted access from My Doctors.

| Result for preview, approval and rejection | Response |
| --- | --- |
| Missing authentication / non-Patient role | `401` / `403` |
| Malformed request body | `400 INVALID_INPUT` |
| Unknown or expired token, or Doctor no longer eligible | `404 INVITATION_INVALID` |
| Token assigned to another account or no eligible account at issuance | `403 INVITATION_ACCOUNT_MISMATCH` |
| Previously accepted token | `409 INVITATION_USED` |
| Rejected token, preview or approval | `409 INVITATION_REJECTED` |
| Rejection succeeds or the intended Patient repeats it while eligible | `204` |

### Migration 018 rollout after review

`018_patient_invitation_rejection.sql` adds a boolean defaulting to false so
existing tokens retain their approval/expiry semantics. A rejected token must
have a targeted patient and a consumption timestamp. Older server builds still
recognize that timestamp and refuse reuse. No relationship backfill is needed.

1. Review the SQL, application change and local PostgreSQL results. On an
   isolated staging database, rehearse an upgrade from migration 017 with
   existing pending and consumed invitations. Release the candidate to staging
   after migrating and run the review, rejection, replay and existing-consent
   checks with synthetic accounts.
2. Verify the destination, recovery point, and migration ledger. If version
   018, its reviewed checksum, and its schema are already verified, proceed to
   the application release. An environment with 018 still pending requires
   separate approval and the reviewed procedure scoped to that migration.
   Schedule the schema change for a quiet window because `ALTER TABLE` locks
   the invitations table while the constraint is validated. Verify the ledger
   and schema after the change. Render does not run migrations automatically.
3. Release the compatible application build and verify service readiness and
   error rates. If the application needs a rollback, roll back its build and
   leave migration 018 in place. The older build reports rejected links as used.

## Limitations

Doctor lists, records and activity refresh on focus and every 15 seconds while
visible. A confirmed denial from the record or activity endpoint clears that
patient's protected data from the Doctor's view and query cache. An already
authorized response can arrive after revocation, and delivered data cannot be
recalled. Expired/generated
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
