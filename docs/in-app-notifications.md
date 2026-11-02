# In-app notifications — Phase 1

## Existing infrastructure reused

The shared header now uses the real notification API instead of its previous demo
dialog. Existing PostgreSQL sessions, CSRF protection, authenticated requests,
React Query, account-cache cleanup, modal, feedback and Living 3.3 tokens remain
the foundation. No dependency or authentication change is required.

## Data and supported events

- `010_in_app_notifications.sql` creates `chroniccare.notifications`, ownership
  and unread indexes, and transactional relationship-change triggers.
- `011_notification_cascade_guard.sql` hardens the trigger against user-deletion
  cascades. Migration 010 had already been applied to the isolated test database;
  its checksum is preserved rather than rewriting migration history.
- A row contains only its UUID, recipient user UUID, event type, creation time
  and nullable read time. API responses omit the recipient UUID.
- Explicit patient approval creates `connection_approved` for both participants.
  Revoking an existing relationship creates `connection_revoked` for both.
- Code generation, review, repeated approval and repeated revocation create no
  duplicate events. Legacy relationships are not backfilled as patient-approved.
- Events share the relationship transaction: rollback also rolls back events.
  Account-deletion cascades do not invent patient-initiated revocations.
- Notifications contain no names, clinical values or medical message bodies.
  Event text is translated in React. There are no clinical reminders or alerts.

## API

All endpoints require a valid session and derive ownership exclusively from it.
All three roles can read only their own notifications; Admin has no bypass.

| Method / route | Response |
| --- | --- |
| `GET /api/notifications` | `{ notifications: [{ id, type, createdAt, readAt }] }` |
| `GET /api/notifications/unread-count` | `{ unreadCount: 0 }` |
| `PUT /api/notifications/:id/read` | `{ notification: { id, type, createdAt, readAt } }` |

Mark-read requires the existing CSRF cookie/header and origin protections. It is
idempotent and preserves the first read timestamp. Unknown and other-account
identifiers both return 404. Ownership query/body overrides are rejected.

The UI loads at most the newest 50 entries. The count covers all unread entries.
It refreshes every 30 seconds while the tab is active, and on window focus;
connection actions in the current account invalidate it immediately. This is
polling, not push. A read action updates the UI after server confirmation; failed
writes remain unread and can be retried explicitly. Guest mode has no notification
fixtures or authenticated notification requests.

## Migration and local verification

Only the separate PostgreSQL test database was migrated during implementation.
After review, the operator must apply both numbered migrations to the application
database before starting this version. From `apps/backend`, with the intended
`DATABASE_URL` configured privately in `.env`:

```powershell
npm run db:migrate
npm run dev
```

Start React from `apps/frontend` with `npm run dev`.

For automated persistence checks, configure a distinct `TEST_DATABASE_URL` whose
database name ends in `_test`, then run from `apps/backend`:

```powershell
node --env-file-if-exists=.env --import tsx --test --test-concurrency=1 tests/notifications.test.ts tests/connections.test.ts tests/database.test.ts
```

The focused real browser test is `node scripts/notifications-browser.mjs` from
`apps/frontend` (requires installed Playwright/Edge; `PLAYWRIGHT_MODULE_PATH` can
point to an existing Playwright module). It creates temporary accounts only in
the guarded test database, runs Express and Vite on ports 3313/5193, and removes
its accounts afterward. Results and its Arabic mobile screenshot are written to
`apps/frontend/artifacts/notifications/`.

Manual checks with test accounts:

1. Sign in as a Patient with no connections: the bell opens a real empty state.
2. Generate a Doctor connection code, review it as that Patient and approve.
   Both participants receive a generic approval event in their own bell.
3. Mark one event as read. Refresh or sign out/in: its read state remains.
4. Revoke the connection. Both receive a revocation event; Doctor access is still
   governed by the existing relationship checks.
5. A different Patient and an unrelated Admin see none of those events.

## Limits and next phase

There is no historical backfill, older-entry pagination, retention policy,
notification deletion, SSE/WebSocket delivery or FCM integration in this phase.
The newest-50 list may omit older unread entries included in the total count.
Production deployment and application-database migration were not performed.

FCM should be an additional delivery channel for these authoritative PostgreSQL
events: introduce explicit user opt-in and securely owned device registrations,
send only generic previews from the backend, handle invalid tokens and duplicate
delivery, and keep server authorization when opening a notification. Provider
credentials must remain server-side. No push subscription or delivery is enabled
by this implementation.
