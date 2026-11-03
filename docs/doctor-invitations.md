# Doctor invitations and activation

Earlier account-foundation documentation covered **Admin email activation** and
**Doctor creation with an initial password**. It did not implement Doctor email
activation. Doctor onboarding now uses the same account-token infrastructure.

## Deployment

Apply migration `014_doctor_invitations.sql` before deploying this change. It adds
the `doctor_activation` token purpose and the invited name; existing users and
credentials are unchanged. It was applied only to `chroniccare_test` during
verification. The application database still requires this migration.

Configure the existing email abstraction with `EMAIL_PROVIDER`, `EMAIL_API_KEY`,
`EMAIL_FROM`, and the correct HTTPS `APP_PUBLIC_ORIGIN`. Missing delivery returns
503; provider failure rolls back the invitation. Provider acknowledgement is not
proof of inbox delivery. Do not use a capture transport for production onboarding.

## Product flow and API

Admin submits the Doctor's name and email through the existing dialog.
`POST /api/admin/doctors` now accepts **only** `{name,email}` and returns
`{invitation:{name,email}}` after delivery acknowledgement. It never accepts or
returns a Doctor password or activation token. `GET /api/admin/doctors` continues
to list activated Doctor accounts, including pre-existing Doctors.

The captured or delivered link opens `/activate-doctor#token=...`. The existing
activation form removes the fragment from the address bar and lets the Doctor
choose and confirm a password. `POST /api/accounts/activate-doctor` accepts only
`{token,password}`. The account is created with the invitation's email/name and
Doctor role only after validation. Patient consent is still required for access.

Tokens contain 256 random bits. Only their SHA-256 hashes are persisted, with a
20-minute expiration, delivery flag and consumption timestamp. Redemption locks
and consumes the token atomically with Argon2id credential/account creation.
Invalid, expired, wrong-purpose and reused tokens fail. Identity/role overrides
are rejected; an existing account cannot be promoted or overwritten.

An active duplicate invitation returns 409. After expiry, Admin may submit the
same name/email again; the prior token is consumed. Existing accounts return 409.
Invitation records are not login accounts and appear in the active list only
after activation. No database account is created when email is unavailable.

## Verification

Focused backend coverage is in `tests/admin.test.ts` and
`tests/account-foundation.test.ts`; existing auth/Doctor/connection tests cover
compatibility. Tests use a dedicated database and injected capture/failing
transports, never a real mailbox. Keep captured tokens and fixture details out of
reports and screenshots. Original browser runners that submit an initial Doctor
password must be updated to the invitation contract before being used.
