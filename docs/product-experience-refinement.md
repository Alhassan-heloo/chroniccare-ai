# ChronicCare AI — Living 3.3 experience refinement

> Historical Living 3.3 report and authentic palette reference. [Living Evolution](living-evolution-redesign.md) is the current frontend implementation; it supersedes prior layout restrictions and the rejected ChronicCare 4.0 visual direction. Security, consent, data, API and backend constraints remain in force.

Review date: 2 November 2026.

The existing product now uses one Living 3.3 foundation across Public, Patient,
Doctor and Admin workspaces. The main Patient compositions, recent Admin work,
and real Assistant conversation behavior were retained. Changes address observed
gaps in clinical, connection, account, recovery and shared feedback interfaces.

## Observations and design decisions

The baseline review covered every existing route in Edge, using intercepted API
fixtures. The homepage, Patient Health Canvas and recent Admin composition were
already strong. Doctor pages, My Doctors and Profile changed to an older visual
identity; recovery pages had oversized, off-center forms and excessive spacing.
Profile also described account support as a future feature despite an active
session. Public Assistant copy incorrectly described the existing assistant as a
future feature and suggested questions requiring automatic access to records.

The refinement preserves the approved palette rather than inventing new tokens:
Ocean Graphite `#0b1320`, raised ocean `#162437`, aqua `#69e1d7`, cloud
`#f1f5f9`, light ink `#182c42` and light aqua `#146c69`. Semantic pressure,
glucose, medication, habit and report colors remain unchanged. Cairo remains the
only product typeface. Existing Tidal Weave artwork provides the signature; quiet
surfaces, purposeful borders and clear text carry the rest of the interface.

Patient pages retain the compact rail and Health Canvas. Doctor pages use a
wider, text-led navigation rail and restrained clinical lists. Admin keeps its
recent account-management composition. Account recovery uses a centered form
with a readable line length. My Doctors separates entering/reviewing a code from
existing connections on desktop and stacks those regions on mobile.

These composition judgments are subjective design decisions. The previous shell
switch, stale copy, missing inline recovery validation, and secondary-button
border reset were confirmed in source and rendered screenshots.

## Improvements

- All protected routes share the existing Living shell, Ocean Graphite surfaces,
  Cairo typography, motion preferences, theme and semantic colors.
- Reusable `PageHeading` connects clinical, connection and account pages to the
  existing decorative Tidal Weave. It has one page title, context and an optional
  action without introducing a new component library.
- Doctor pages have contextual heading actions, a readable patient count,
  clear read-only scope, semantic record section colors, nested-route orientation,
  and accessible tablet/mobile navigation. Connection codes remain selectable.
- My Doctors has local required-code validation and first-error focus. Removing
  access opens a confirmation explaining the effect and retaining records.
  Cancellation restores focus. Pending removal cannot dismiss the dialog or issue
  a second request. The existing authorization APIs and payloads are unchanged.
- Profile shows the current session's name, email and role, plus a direct link to
  connection management. It remains read-only; no account-editing API was added.
- Forgot password, reset password and Admin activation have centered, compact
  forms, associated field errors, first-error focus and a password reveal control.
  Existing token handling, submission endpoints and session behavior remain intact.
- Shared secondary buttons regain visible boundaries. Feedback, empty/loading
  states, notification unread treatment, browser opt-in explanation and modal
  headings use the existing Living tokens. Dialog headings remain available during
  scrolling. Existing native-dialog keyboard/focus behavior is retained.
- Route changes return the protected workspace to its start and focus its main
  landmark. In-page anchors retain their existing behavior.
- Public Assistant copy now describes the existing educational assistant and
  independent questions accurately. A link opens the existing protected Assistant
  route. Preview questions are general and do not imply access to account records.
  The preview still sends no questions and generates no answers.
- Role labels describe the person, instead of incorrectly saying "dashboard".
  New content is present in both Arabic and English.
- Not-found/error recovery uses the public Living layout and localized directions.

## Route coverage

Every existing route was included. "Preserved" means the existing composition was
reviewed and retained; it still receives applicable shared controls/feedback work.

| Group | Routes | Treatment |
| --- | --- | --- |
| Public | `/` | Product-led composition preserved; Assistant discovery/copy refined |
| Authentication | `/login`, `/register`, `/setup` | Existing composition preserved; shared controls reviewed |
| Account recovery | `/forgot-password`, `/reset-password`, `/activate-admin` | Layout, validation, focus and password visibility refined |
| Patient | `/patient/dashboard`, `/patient/measurements`, `/patient/medications`, `/patient/habits`, `/patient/reports` | Existing page compositions and One-Tap behavior preserved |
| Assistant | `/patient/assistant` | Existing real interface preserved; shared feedback/dialog/navigation reviewed |
| Patient account | `/patient/profile`, `/patient/doctors` | Account summary and connection workspace refined |
| Doctor | `/doctor/dashboard`, `/doctor/patients`, `/doctor/patients/:patientId`, `/doctor/connect` | Shared shell, clinical hierarchy, record presentation and navigation refined |
| Admin | `/admin/dashboard` | Recent composition preserved; regression verified |
| Fallback | Unknown route | Localized Living recovery page |

Notifications and browser opt-in are shared interfaces, not separate routes.

## Browser evidence

Evidence is local and ignored by Git under `apps/frontend/artifacts/experience/`:

- `before/report.json`: 42 baseline captures (all 21 route cases at desktop English
  dark and mobile Arabic light).
- `after/report.json`: final responsive and interaction results.
- `comparison.html`: offline before/after selector for every baseline route.
- `before-inventory.png`, `after-inventory.png`: browser-rendered desktop route
  contact sheets, reviewed alongside larger captures.
- `after/interaction-*.png`: connection review, removal confirmation, notification
  unread/empty/loading/error states, generated code and recovery validation.
- Interaction captures also have `-viewport.png` versions. Full-document captures
  of fixed/top-layer dialogs can show background content outside the viewport;
  use the viewport version when judging modal placement.

Representative comparisons use matching filenames in `before/` and `after/`:

| File | Before | After |
| --- | --- | --- |
| `1440-en-dark-_doctor_dashboard.png` | Older rectangular shell and full-width connection action | Living shell, clinical navigation and heading action |
| `1440-en-dark-_patient_doctors.png` | Old shell and vertically disconnected regions | Living shell with adjacent code review and current access |
| `1440-en-dark-_patient_profile.png` | Stale future-feature placeholder | Current account identity and access-management direction |
| `1440-en-dark-_forgot-password.png` | Wide off-center form and loose spacing | Centered recovery form with restrained hierarchy |
| `390-ar-light-_doctor_dashboard.png` | Older mobile styling | Living styling and explicit clinical mobile navigation |

The responsive matrix uses 320, 390, 768, 1440 and 1920px. It combines English
LTR/dark desktop, Arabic RTL/light mobile, English LTR/light small mobile, Arabic
RTL/dark tablet and English LTR/light wide desktop. It is deliberately not every
permutation. Both languages additionally exercise representative interactive
states at 320px and clinical navigation at 768px. System appearance, Motion Off
persistence, reduced motion, loaded Cairo, overflow, and computed text contrast
are checked where recorded in the report.

## Technical verification

| Check | Actual result |
| --- | --- |
| `npm run typecheck` | PASS, including the frontend and script TypeScript configurations |
| `npm run lint` | PASS |
| `npm run check:translations` | PASS: 678 matching keys and compatible placeholders; advisory dynamic/unused-key output remains |
| `npm run test:smoke` | PASS: 14 route renders, locale checks, schemas, and measurement/medication/habit/report regressions |
| `npm run build` | PASS: 2,466 modules transformed; final CSS is 293.13 kB / 47.42 kB gzip |
| `node scripts/experience-browser.mjs --before` | PASS: 42 baseline route/locale/theme captures |
| `node scripts/experience-browser.mjs` against the final production preview | PASS: 105 route/viewport/locale/theme cases plus 16 interactive-state captures, 6 interaction groups, no runtime errors or unexpected requests |
| Responsive and text samples in that browser run | PASS: no detected document/content overflow, correct RTL/LTR, loaded Cairo, no sampled text contrast failures |
| `node scripts/assistant-browser.mjs` | PASS: 18 existing fixture-based checks, including independent requests, loading/errors and language/mobile behavior |
| `node scripts/admin-design-browser.mjs` | PASS: 13 existing fixture-based checks, including validation, keyboard flow, responsive/locale states and unchanged payloads |
| `node scripts/experience-gallery.mjs` | PASS: offline comparison and two browser-rendered route contact sheets |
| `git diff --check` | PASS |

The final full experience run used the built application at
`http://localhost:5189`, rather than hot-reloaded development assets. Interaction
checks include pending-removal dismissal protection, cancellation/focus return,
one removal request, notification read/empty/loading/error/retry states, first-error
focus, system appearance changes, Motion Off persistence, mobile navigation,
clinical read-only presentation and recovery token removal from the visible URL.

The build reports two third-party Zod comment-annotation warnings; it completes
successfully. No dependency code was changed to suppress them. Browser evidence
uses headless Microsoft Edge; cross-browser/device certification was not performed.

## Files changed by this task

All paths below are relative to `apps/frontend/`, except this report.

Modified:

- `src/app/routes.tsx`
- `src/components/layout/DashboardLayout.tsx`
- `src/components/layout/Header.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/navigation.ts`
- `src/components/public/living/LivingHome.tsx`
- `src/components/ui/Input.tsx`
- `src/components/ui/Modal.tsx`
- `src/i18n/locales/ar.ts`
- `src/i18n/locales/en.ts`
- `src/main.tsx`
- `src/pages/auth/AccountEmailPage.tsx`
- `src/pages/connections/ConnectionPages.tsx`
- `src/pages/doctor/DoctorPages.tsx`
- `src/pages/patient/PlaceholderPages.tsx`
- `scripts/smoke.tsx` (updated the former page-limited Living assertion to cover
  every protected role while retaining page-specific adapter checks)

Added:

- `src/components/ui/PageHeading.tsx`
- `src/pages/public/UnavailablePage.tsx`
- `src/styles/experience.css`
- `scripts/experience-browser.mjs`
- `scripts/experience-gallery.mjs`
- `docs/product-experience-refinement.md` (repository root `docs/`)

Pre-existing changes to `apps/backend/tests/app.test.ts`,
`apps/frontend/.env.example`, and
`apps/frontend/scripts/audit-firebase-bundle.mjs` were preserved and are not part
of this task. No backend, API, database, authentication, security or dispatch
implementation was changed. No dependencies were installed. No commit or push
was made.

## Limits and manual review

This is frontend verification with isolated presentation fixtures. It does not
re-certify live PostgreSQL integration, email delivery, AI provider behavior or
FCM registration/delivery. No live account/medical data was edited, no paid AI
request was made, and no push notification was sent. Database integration scripts
were deliberately not run because they create/delete records and apply migrations.

Computed text contrast sampling does not certify WCAG compliance; gradient/image
backgrounds, non-text contrast, assistive-technology compatibility and real-device
usability still need human review. The account summary is intentionally read-only.
The Assistant continues to send independent questions and has no added memory.

For review:

1. Open `apps/frontend/artifacts/experience/comparison.html` and compare the key
   clinical, My Doctors, account and recovery pages at 1440 and 390px.
2. Review the viewport interaction captures for narrow dialogs and notification
   states, then the contact sheets for consistency across all route groups.
3. To reproduce isolated checks, start the frontend with `npm run dev -- --port
   5188 --strictPort` in `apps/frontend`. Run `node scripts/experience-browser.mjs`.
   Set `PLAYWRIGHT_MODULE_PATH` to an existing Playwright installation if needed.
   The script intercepts all API traffic and rejects unexpected external requests.
4. Run `node scripts/experience-gallery.mjs` to regenerate the comparison and
   contact sheets from the captures.
5. For manual application review, use existing authorized accounts to inspect
   each role's navigation, switch language/theme/motion, and inspect forms without
   submitting real account or health-data changes.
