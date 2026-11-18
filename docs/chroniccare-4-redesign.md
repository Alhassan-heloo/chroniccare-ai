# ChronicCare AI 4.0 — Adaptive Health Experience

> Historical, rejected visual direction. Its teal/green presentation is no longer active. See [Living Evolution](living-evolution-redesign.md) for the current implementation and verification. This report and its source changes were retained in the recoverable local backup.

Review date: 2 November 2026. Implemented in the existing React/TypeScript/Vite application. Awaiting manual design approval; this is not a production-readiness declaration.

## Design direction

Clinical editorial composition, a precise data language, and role-specific health workspaces replace Living 3.3's floating masthead, narrow icon rail, decorative waves, and repeated rounded panels. The distinctive element is a care ledger: latest values, recorded trends, daily actions, and authorized records have visibly different information regions.

Light palette: deep teal `#075d5a`, porcelain `#f1f6f5`, ink `#123332`, white `#ffffff`, slate green `#4b6862`, and measurement blue `#346f9c`. Dark mode uses forest surfaces `#102321`/`#18312d`, pale text `#edf6f3`, and a muted mint action `#94d8bf`. Blood pressure, glucose, medication, habits, reports, and errors retain distinct semantic colors without clinical classification.

The existing self-hosted Cairo variable font serves Arabic and English. Headlines use a responsive 28–56px scale with start alignment; data uses tabular numbers and explicit unit/direction handling. No runtime font service, image service, component framework, animation library, or other dependency was added.

## Navigation and shared foundation

- Desktop: one 68px masthead, a 224px labeled navigation column, full-width workspaces with 32px gutters, and page-specific information hierarchy.
- Tablet: a 76px icon navigation rail with accessible destination names and tooltips; wider workspaces reflow rather than compress.
- Phones: a 64px branded header, 16px gutters, thumb-sized primary actions, patient bottom navigation with a native More dialog, and compact doctor role navigation. Logout stays visible; appearance/language/motion controls have a dedicated dialog.
- Shared controls use 44px minimum action targets, 48px inputs, visible focus, restrained 8–14px geometry, solid surfaces, and semantic feedback. Existing native dialog focus/escape behavior is retained, with phone sheets, close buttons and safe-area padding.
- Notifications put the unread/list context before browser registration, distinguish unread items, retain loading/error/retry/read states, and become a full-height phone sheet.
- Motion Off and reduced motion disable transitions/animations. Decorative atmospheric layers and waves no longer drive the identity. Charts remain lazy loaded; existing React Query hooks, mutation locks and optimistic updates are retained.

The implementation retains legacy adapter class names where useful for components and tests. `adaptive.css` loads last from `main.tsx` and defines the current tokens/shell; page styles are scoped separately. This is an incremental frontend replacement, not a backend or data-model rewrite.

## Page-by-page coverage

Every route below has rendered browser coverage at all eight requested widths in representative locale/theme combinations. “Shared redesign” means the existing page content was retained and received the new shell, typography, controls and surfaces; it does not imply a new account feature.

| Route | Actual change | Desktop and mobile treatment |
|---|---|---|
| `/` | Complete product-led editorial composition | Split first screen, explicitly labeled care preview, broad measurement showcase, daily-care ledger, consent sequence, educational assistant and privacy CTA; phone composition and compact menu |
| `/login` | New authentication composition | Distinct storytelling and functional form regions; form leads on mobile |
| `/register` | New registration composition | Related fields paired on desktop, single-column phone form, password visibility and unchanged validation |
| `/setup` | Initial setup in the new authentication system | Focused form with existing availability/security feedback and narrow-screen controls |
| `/forgot-password` | Focused recovery composition | Calm context beside the form, explicit request success/error, mobile form first |
| `/reset-password` | Focused recovery composition | Existing invalid-link/token handling and password controls in the new layout |
| `/activate-admin` | Focused activation composition | Security-oriented account context and original completion/failure states; token not displayed |
| `/patient/dashboard` | Major workspace recomposition | Separate latest-value slab, daily overview/actions, weekly chart and medication region, horizontal habit ledger and supporting links; phone order deliberately reflows |
| `/patient/measurements` | New tracking overview and history workspace | Latest pressure/glucose with dates, real 30-day daily-average chart, compact filters and full-width history; readable mobile records/forms |
| `/patient/medications` | Summary rail and schedule ledger | Medication name/dose/time/actions retain hierarchy; compact phone summary and full-width schedules |
| `/patient/habits` | Daily progress band and action workspace | Existing one-tap/precise controls, all/ongoing/completed views, template disclosure; mobile actions stay large and templates are progressively disclosed |
| `/patient/reports` | Integrated reporting hierarchy | Period controls, horizontal existing-statistic strip, paired charts and reading ledger; single-column phone analysis |
| `/patient/doctors` | Consent-first connection workspace | Permissions context, focused code review and authorized-doctor region; narrow-screen approval/revocation dialogs |
| `/patient/assistant` | New conversation and guidance workspace | Conversation with supporting safety/reference rail; phone layout fits the composer into the available viewport, keeps an independent message log, and places privacy guidance in a disclosure |
| `/patient/profile` | Shared redesign | Account identity/details and consent navigation retain existing functionality; adaptive surfaces, type and mobile layout |
| `/doctor/dashboard` | Professional roster workspace | Actual authorized patients, compact census and distinct consent rail; mobile directory rows and role navigation |
| `/doctor/patients` | Structured patient directory | Scan-friendly selection rows with real metadata, clear empty/error states and focused list-to-record flow |
| `/doctor/patients/:patientId` | Structured read-only record | Patient context, section navigation, existing record sections and lazy seven-day daily-average charts; compact phone section navigation, no editing controls |
| `/doctor/connect` | Focused connection workflow | Code generation, selection and actual expiration semantics with private-sharing/approval guidance; readable phone code area |
| `/admin/dashboard` | Roster-first operational workspace | Compact available-account summary, structured doctor list and independent creation panel; mobile jump actions and stacked form/list |
| `*` / unavailable | Shared redesign | Existing error/not-found guidance and recovery link in the adaptive public shell |

No route or API contract was added. New UI views use existing data and actions; no score, diagnosis, risk ranking, export, prescription or reminder service was invented.

## Before/after gallery

Open [the interactive comparison](../apps/frontend/artifacts/adaptive/comparison.html) for all 42 matching route captures. It pairs **1440px English dark** and **390px Arabic light** with the same intercepted demonstration-account states. The gallery labels these as fixtures; no real medical records were used.

![Seven required desktop/mobile comparisons](../apps/frontend/artifacts/adaptive/comparison-overview.png)

Each row contains desktop before/after and phone before/after for homepage, patient dashboard, measurements, habits, doctor dashboard, admin dashboard and assistant. Complete images are available through the comparison selector. Artifacts are local and Git-ignored; regenerate before sharing a checkout.

## Verification

The final verification results and artifact paths are recorded below after execution. All browser fixtures intercept API traffic; no provider delivery or live health-data write is part of these checks.

| Check | Executed result |
|---|---|
| Frontend + script TypeScript | `npm run typecheck` passed |
| ESLint | `npm run lint` passed, including new browser/gallery scripts |
| Production build | `npm run build -- --configLoader runner` passed; 2,466 modules transformed; existing Zod annotation warnings only |
| Translation consistency | `npm run check:translations` passed: 678 matching keys and compatible placeholders; unused/dynamic-key notices remain advisory |
| Existing frontend smoke/component invariants | `npm run test:smoke` passed: 14 route renders plus schema, measurement/medication/habit CRUD adapter, latest-reading, date-window, report-average and empty-account checks |
| All-route browser sweep | [168 route cases](../apps/frontend/artifacts/adaptive/after/route-report.json) passed at 320, 360, 390, 430, 768, 1024, 1440 and 1920px; no document overflow, detected outside content, font failure, direction mismatch or sampled text-contrast failure |
| Interaction regression | [16 captured state cases](../apps/frontend/artifacts/adaptive/after/interactions.json) passed after the notification sheet fix, with zero unexpected requests or browser exceptions |
| Visual comparison | 42 matching before/after route captures and seven desktop/mobile comparison rows generated and inspected |
| Whitespace | `git diff --check` passed |

The route sweep completed all 168 route checks, then exposed a 320px notification-action wrapping defect during interactions. The sheet width/flex layout was corrected and the complete interaction phase was rerun successfully. `route-report.json` retains the earlier diagnostic and points to the passing retest rather than hiding the initial failure. The route cases are extracted from actual captures, not inferred from a later test. The isolated clinical harness additionally verified staff phone navigation; the interaction harness uses the new tablet sidebar rather than its obsolete mobile-tab selector.

Viewport settings were 1440/en/dark, 390/ar/light, 320/en/light, 360/ar/dark, 430/en/light, 768/ar/dark, 1024/en/light and 1920/en/light. This is representative coverage, not a claim that every cross-product combination was tested. Motion preference, dialog focus restoration, More navigation, theme/system changes, notifications and connection/recovery states were exercised in the interaction phase.

Focused workflow evidence:

- Public/account: [report](../apps/frontend/artifacts/adaptive-public/report.json), 28 route cases plus two mobile interaction groups. Checked validation/focus, password visibility, recovery success/invalid links, visible-URL token removal, homepage type/day controls, water increment/undo, and mobile-menu Escape.
- Patient records: [report](../apps/frontend/artifacts/adaptive-records/report.json), three viewport/locale/theme workflow sets and 15 captures. Checked measurement creation/filtering/type controls, medication dose logging/editing, cancellation of destructive actions, habit quick progress/failed-write rollback/template identity, and report periods. A desktop history-width assertion protects the grid defect found during visual review.
- Clinical: [report](../apps/frontend/artifacts/adaptive-clinical/after/clinical-report.json), 15 captures across 1440px English dark, 390px Arabic light, and 320px English light. Checked directory/record navigation, read-only controls, section anchors, patient empty/error/retry, generated-code selection and one generation request.
- Admin: [report](../apps/frontend/artifacts/admin-refinement-phase2c/after/report.json), 13 checks covering validation, focus, password visibility, pending/creation, exact request payload, refreshed roster, keyboard order, themes/locales, empty/error/retry and 320px overflow.
- Assistant: [report](../apps/frontend/artifacts/assistant-frontend/report.json), 18 checks including independent API payloads, CSRF header, Enter/Shift+Enter, duplicate-send lock, server safety text, safe plain-text rendering, long-chat scrolling, eight failures/explicit retry, language/direction, no conversation persistence, session expiry and role guards.

Screenshots were visually inspected in addition to DOM geometry checks. Confirmed defects fixed during review included inherited implicit history columns, header flex-basis/RTL overflow, tablet destination selectors, public preview heading inheritance, and mobile chat composer placement.

## Scope and limitations

Completed and browser-verified: all existing route groups, shared navigation/preferences, notification read/unread/loading/empty/error/retry, consent confirmation/cancel/focus, and the focused workflows above. No page is intentionally left on the previous identity.

Completed but not verified against live services: production PostgreSQL persistence, real email delivery/activation, live AI responses, browser FCM registration and push delivery. Their implementations/contracts were preserved; browser tests used isolated responses. Existing integration scripts that apply migrations/create/delete test accounts were not run under this task's no-migration/no-account-deletion constraints.

Remaining manual verification: physical iOS/Android on-screen keyboard and browser-toolbar behavior, screen-reader review, full contrast/keyboard auditing, and real-device performance. Desktop Edge viewport checks and sampled text contrast do not establish complete WCAG 2.2 AA compliance. Production dependency build emits existing Zod comment-annotation warnings; the build succeeds. Existing historical CSS remains for adapter compatibility; no new dependency was installed.

Existing product boundaries remain explicit: the assistant handles each request independently and provides educational information; dashboard reminder disclosure remains temporary/demo where already supported. No clinical interpretation or new backend feature was added.

Unfinished implementation: none identified in the route inventory. Manual design approval and the device/live-integration checks above remain outstanding. No commit or push was made.

## Files changed

- [.agents/skills/chroniccare-workflow/SKILL.md](../.agents/skills/chroniccare-workflow/SKILL.md)
- [apps/frontend/NEXT_GENERATION_REDESIGN.md](../apps/frontend/NEXT_GENERATION_REDESIGN.md)
- [apps/frontend/scripts/adaptive-browser.mjs](../apps/frontend/scripts/adaptive-browser.mjs)
- [apps/frontend/scripts/adaptive-gallery.mjs](../apps/frontend/scripts/adaptive-gallery.mjs)
- [apps/frontend/scripts/adaptive-public-qa.mjs](../apps/frontend/scripts/adaptive-public-qa.mjs)
- [apps/frontend/scripts/adaptive-records-browser.mjs](../apps/frontend/scripts/adaptive-records-browser.mjs)
- [apps/frontend/scripts/admin-design-browser.mjs](../apps/frontend/scripts/admin-design-browser.mjs)
- [apps/frontend/scripts/assistant-browser.mjs](../apps/frontend/scripts/assistant-browser.mjs)
- [apps/frontend/scripts/smoke.tsx](../apps/frontend/scripts/smoke.tsx)
- [apps/frontend/src/components/health/AssistantCard.tsx](../apps/frontend/src/components/health/AssistantCard.tsx)
- [apps/frontend/src/components/layout/DashboardLayout.tsx](../apps/frontend/src/components/layout/DashboardLayout.tsx)
- [apps/frontend/src/components/layout/Header.tsx](../apps/frontend/src/components/layout/Header.tsx)
- [apps/frontend/src/components/layout/NotificationCenter.tsx](../apps/frontend/src/components/layout/NotificationCenter.tsx)
- [apps/frontend/src/components/layout/Sidebar.tsx](../apps/frontend/src/components/layout/Sidebar.tsx)
- [apps/frontend/src/components/public/PublicHeader.tsx](../apps/frontend/src/components/public/PublicHeader.tsx)
- [apps/frontend/src/components/public/PublicLayout.tsx](../apps/frontend/src/components/public/PublicLayout.tsx)
- [apps/frontend/src/main.tsx](../apps/frontend/src/main.tsx)
- [apps/frontend/src/pages/admin/AdminDashboard.tsx](../apps/frontend/src/pages/admin/AdminDashboard.tsx)
- [apps/frontend/src/pages/auth/AccountEmailPage.tsx](../apps/frontend/src/pages/auth/AccountEmailPage.tsx)
- [apps/frontend/src/pages/auth/AuthPage.tsx](../apps/frontend/src/pages/auth/AuthPage.tsx)
- [apps/frontend/src/pages/connections/ConnectionPages.tsx](../apps/frontend/src/pages/connections/ConnectionPages.tsx)
- [apps/frontend/src/pages/doctor/DoctorPages.tsx](../apps/frontend/src/pages/doctor/DoctorPages.tsx)
- [apps/frontend/src/pages/patient/AssistantPage.tsx](../apps/frontend/src/pages/patient/AssistantPage.tsx)
- [apps/frontend/src/pages/patient/DashboardPage.tsx](../apps/frontend/src/pages/patient/DashboardPage.tsx)
- [apps/frontend/src/pages/patient/HabitsPage.tsx](../apps/frontend/src/pages/patient/HabitsPage.tsx)
- [apps/frontend/src/pages/patient/MeasurementsPage.tsx](../apps/frontend/src/pages/patient/MeasurementsPage.tsx)
- [apps/frontend/src/pages/patient/MedicationsPage.tsx](../apps/frontend/src/pages/patient/MedicationsPage.tsx)
- [apps/frontend/src/pages/patient/ReportsPage.tsx](../apps/frontend/src/pages/patient/ReportsPage.tsx)
- [apps/frontend/src/pages/public/HomePage.tsx](../apps/frontend/src/pages/public/HomePage.tsx)
- [apps/frontend/src/styles/adaptive-clinical.css](../apps/frontend/src/styles/adaptive-clinical.css)
- [apps/frontend/src/styles/adaptive-public.css](../apps/frontend/src/styles/adaptive-public.css)
- [apps/frontend/src/styles/adaptive-records.css](../apps/frontend/src/styles/adaptive-records.css)
- [apps/frontend/src/styles/adaptive.css](../apps/frontend/src/styles/adaptive.css)
- [docs/chroniccare-4-redesign.md](../docs/chroniccare-4-redesign.md)
- [docs/product-experience-refinement.md](../docs/product-experience-refinement.md)
- [README.md](../README.md)

The pre-existing edits in `apps/backend/tests/app.test.ts` and `apps/frontend/.env.example` were preserved and are excluded from the redesign file list. Backend architecture, schemas/migrations, authentication code, API client/hooks, and real medical/account data were not changed by the redesign.

## Preview and manual review

The local frontend preview is available at [http://localhost:5188](http://localhost:5188). Use the offline comparison for fixture states without signing into any account.

To restart the frontend from `apps/frontend`:

```powershell
npm run dev -- --port 5188 --strictPort --configLoader runner
```

For production assets:

```powershell
npm run build -- --configLoader runner
npm run preview -- --port 5189
```

The runner loader avoids a Windows sandbox configuration-bundling path restriction encountered locally. No environment file was changed for this task.

To rerun fixture browser checks, point `PLAYWRIGHT_MODULE_PATH` to an existing Playwright installation, keep the local frontend running on port 5188, and run:

```powershell
node scripts/adaptive-browser.mjs
node scripts/adaptive-public-qa.mjs
node scripts/adaptive-records-browser.mjs
node scripts/adaptive-gallery.mjs
```

For manual review, open the homepage/login/register/recovery flows, then use an existing authorized test account for each role. Check English/Arabic, light/dark/system, all requested widths, mobile More/settings/notifications, add/edit/cancel forms, habit rollback, connection approval/revocation, doctor read-only navigation and assistant loading/failure. Do not modify real patient records to review the design. Physical keyboard and phone keyboard checks should include visible close actions, safe areas, long conversations and focus restoration.

The implementation is ready for manual design review; user approval is the next step.
