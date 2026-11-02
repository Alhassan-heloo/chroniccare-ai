# AI Health Assistant — Phase 2 frontend

The existing `/patient/assistant` route and navigation are reused. The former
placeholder now re-exports AssistantPage; Profile and other routes are unchanged.
Only this route opts into the existing Living shell. Ocean Graphite, Cairo,
Tidal Weave, Living Pulse, shared buttons/feedback and motion preferences are
reused without changing shared component implementations.

Design: title/new-conversation action; permanent education/emergency/privacy
notice; scrollable message log; composer below. Patient and assistant surfaces
are differentiated with alignment, color and speaker labels. A separate latest
message action is available when reading earlier content. Automatic scrolling
only happens inside the message log when the reader is already near its bottom
or explicitly submits a question. Response arrival does not steal keyboard focus.

## Integration

`sendAssistantMessage` uses `useAuth().request`, which provides HttpOnly Cookie,
CSRF and account-change/session-expiry handling. It posts exactly `{message,
language}` to `/assistant/messages` through the existing API base. No model/key,
account identity, clinical records, history or previous response ID is attached.
The response parser validates all four fields and the requested language before
display. The returned disclaimer appears on each answer and the latest returned
emergency guidance appears in the permanent safety panel. Static localized
guidance remains visible before success and when requests fail.

Each backend question is independent. The interface explicitly says earlier
messages are not sent. Conversation turns and draft remain only in React state,
not React Query, localStorage, sessionStorage or PostgreSQL. The view is keyed
by Patient ID; role/account changes or leaving the route discard it. Unmount
attempts to abort pending requests. New Conversation clears local state and is
disabled while a request is pending.

The textarea allows 2000 JS string characters. Enter sends, Shift+Enter inserts
a newline, and IME composition does not send prematurely. A synchronous ref lock
prevents duplicates before React updates. Failure produces an accessible error,
never a fallback/model-looking answer. Retry is explicit and reuses the same
patient bubble; it warns about repeated submission/possible quota use. The only
transport retry retained is the existing CSRF refresh on a pre-write CSRF rejection.
Network/timeout failures never automatically resend an LLM request.

Replies and typed messages are rendered as React text, never unsafe HTML. The
UI discloses external AI processing and advises avoiding identifying or unnecessary
medical details. No frontend API key is introduced.

## Actual verification

- Frontend TypeScript, ESLint, smoke/contract/SSR tests and production build passed.
- Translation check: 641 matching keys/placeholders. Dynamic-key advisories are
  not missing translations.
- Edge mocked-backend integration: 18 checks passed, including Enter/newline,
  pending lock, response safety fields, safe HTML-like text, manual scrolling,
  eight failure cases/manual retries, conversation reset, session expiry,
  role redirects, English desktop dark, Arabic mobile light/320px, System theme,
  reduced motion/Motion Off and no persistence/direct OpenAI requests.
- `git diff --check` passed. Two screenshots under
  `apps/frontend/artifacts/assistant-frontend` were visually reviewed; their
  replies are explicitly labelled TEST FIXTURES, not real model answers.

Run from `apps/frontend`:

```powershell
npm.cmd run test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run check
npm.cmd run build
$env:PLAYWRIGHT_MODULE_PATH='PATH_TO_EXISTING_PLAYWRIGHT_MODULE'
npm.cmd run test:assistant-browser
```

The browser test starts only Vite and intercepts the backend. It does not load
backend secrets or call a paid provider. No database test/migration or real
clinical-data modification was necessary in this frontend-only phase.

## Files and remaining work

New: AssistantPage.tsx, lib/api/assistant.ts, living-assistant.css,
scripts/assistant-browser.mjs and this note. Updated: PlaceholderPages.tsx
(re-export only), DashboardLayout.tsx (assistant-only shell opt-in), ar/en
catalogs, scripts/smoke.tsx and package.json (test command).

Before a live end-to-end test, configure the existing backend's server-only key
and compatible model, confirm trusted origins/site/HTTPS settings, review provider
privacy/retention and spending controls, and explicitly approve one non-sensitive
paid test. Actual provider availability, Arabic/English answer quality, clinical
safety and emergency behavior need separate evaluation. Prompt instructions and
disclaimers do not establish medical reliability or production readiness.

No backend/auth redesign, migration, dependency, other-page redesign, commit or
push was performed. Existing work is preserved. Stop for manual review.
