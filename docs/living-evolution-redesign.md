# ChronicCare AI — Living Evolution

Implemented and reviewed on 2 November 2026. The existing React application now uses Living Evolution across every route. Final visual approval is pending; this is not a production-readiness declaration.

## Identity recovered from actual references

The palette was recovered from [the retained Living prototype](../design-prototypes/chroniccare-living/src/style.css), [its README](../design-prototypes/chroniccare-living/README.md), and `git show 0a292f6:apps/frontend/src/styles/living-public.css`. These sources agree on the approved values; HEAD was not assumed to represent the current visual baseline.

| Token family | Dark | Light |
|---|---|---|
| Canvas | Ocean Graphite `#0b1320` | Pearl `#f1f5f9` |
| Primary surface | Ocean `#162437` | White `#ffffff` |
| Text | `#f7faff` | Steel ink `#182c42` |
| Aqua | `#69e1d7` | `#146c69` |
| Measurement blue | `#80a8ff` | `#315fb5` |

The light theme uses the original measurement blue for primary actions while retaining aqua as an accent. Pressure, glucose, medications, habits and reports use the recovered semantic palette. Color identifies information types; it does not classify readings medically. The rejected forest/teal 4.0 theme is no longer imported.

Cairo remains locally hosted. Tidal Weave is retained as restrained decorative SVG, distinct from measured chart series. Living Pulse responds to state changes; there are no added ambient animation loops or external visual dependencies.

## One hybrid styling system

The active chain starts with `globals.css`, imported **before App**. It declares the cascade order `theme, base, components, utilities`, imports Tailwind v4, and loads the organized Evolution foundation:

- `tokens.css`: colors/themes, type scales, spacing, geometry, layout dimensions, shadows and motion.
- `base.css`: font, document defaults, focus and reduced motion.
- `components.css`: controls, forms, validation, dialogs, feedback, notifications and account surfaces.
- `layout.css`: role-aware shell, collapsible desktop navigation, tablet rail and mobile navigation.
- `charts.css`: shared Precision Health Visuals.
- `workspace.css`: patient command center and assistant.
- Route groups own `public.css`, `records.css` and `clinical.css` inside the components layer.

CSS custom properties are the source of truth. Both Tailwind spacing and named CSS spacing derive from `--space-unit`; the browser test changes that unit and verifies that a utility gap and custom panel padding scale together. Tailwind utilities handle suitable flex/grid/alignment/spacing in new compositions. Existing forms and branded components remain custom CSS. No wholesale Tailwind migration, competing framework, dependency installation, or stacked adaptive override layer was introduced.

Previous CSS files remain on disk as recoverable history but are not part of the active import graph. The built CSS is **124.10 kB raw / 20.14 kB gzip**, compared with **379.38 kB / 58.65 kB gzip** in the preceding 4.0 build. This is an asset-size comparison, not a hardware-performance benchmark. Recharts remains lazy loaded through one shared chart component.

## Page-by-page coverage

All 21 route entries were rendered at 1440px English/dark, 390px Arabic/light and 320px English/light. The seven major experiences also received 360, 430, 768, 1024 and 1920px coverage. The final assistant composition was separately rechecked at all eight widths.

| Route | Implemented presentation |
|---|---|
| `/` | New editorial opening above a full-width product Health Canvas, actual Recharts demonstration, routine rail, consent pathway, educational assistant and patient-control closing. Phone previews recompose at readable size. |
| `/login` | Asymmetric form-first authentication portal with restrained brand context; compact phone form. |
| `/register` | Paired desktop fields, single-column phone layout, password guidance/visibility and associated validation. |
| `/setup` | Initial administrator setup within the same portal; existing availability and security behavior preserved. |
| `/forgot-password` | Focused recovery portal with existing success/error and delivery-neutral guidance. |
| `/reset-password` | Recovery composition, invalid-link state and secure password controls; visible URL token removal retained. |
| `/activate-admin` | Focused activation context and existing success/failure workflow; tokens are not displayed. |
| `/patient/dashboard` | Health Command Center: compact daily heading/actions, integrated latest readings and major trend canvas, an actual secondary-series mini chart when available, daily medication/habit band and supporting destinations. |
| `/patient/measurements` | Selectable latest-reading categories above a large trend, compact expandable filters and a readable record ledger. |
| `/patient/medications` | Clear dose summary and medication schedules, with existing dose/edit/delete controls and focused forms. |
| `/patient/habits` | Goal-derived segmented meters, completed/total ring, concise habit rows, one-tap controls and a Manage disclosure for secondary actions. Template identity and optimistic behavior retained. |
| `/patient/reports` | Existing metric summaries, larger primary pressure chart, supporting glucose chart, period controls and readable recent records. |
| `/patient/doctors` | Authorized connection list, permissions context, focused code review, approval and revocation dialogs. |
| `/patient/assistant` | Full-width conversation workspace, split desktop empty state, compact safety disclosure, bounded reading widths and centered composer. Phone prompts reflow and the composer reacts to the visual viewport. |
| `/patient/profile` | Existing account content retained within the shared Evolution typography, surfaces, controls and responsive layout. No unsupported account-editing feature added. |
| `/doctor/dashboard` | Clinical patient roster with embedded count and a distinct connection workspace; no invented urgency metrics. |
| `/doctor/patients` | Readable authorized-patient explorer with focused list-to-record navigation. |
| `/doctor/patients/:patientId` | Patient identity banner, latest actual values, shared charts, expandable history and supporting medication/habit regions. Read-only controls remain read-only. |
| `/doctor/connect` | Focused code workflow with actual expiration information. A wrapping readonly textarea displays and selects the full 32-character code on narrow screens. |
| `/admin/dashboard` | Full-width account ledger and focused creation dialog; pending submissions prevent dismissal. Existing backend validation/account policy remains intact. |
| `*` / unavailable | Existing not-found/error content receives the shared public shell and focused recovery presentation. |

Desktop navigation collapses from 240px to a 76px rail, with accessible names and a persisted preference. Tablet navigation uses the rail automatically. Phones use a compact header, patient bottom destinations plus More, and role-specific clinical navigation. Top/bottom safe areas, native dialog focus handling, visible close actions, and existing logout access are retained.

## Precision Health Visuals

`PrecisionHealthChart` now owns the patient, report, public-preview and doctor chart presentation. Existing `TrendChart` and `ReportChart` interfaces are thin adapters.

- Pressure has distinct systolic and dashed diastolic series, deliberate dots/active points, readable axes, shared legends and units.
- Glucose has a restrained area fill and a precise linear trace.
- Missing calendar days are inserted as **undefined gaps**, not measurements; `connectNulls={false}` prevents bridging them. Aggregation remains in the existing report/dashboard utilities.
- A single day remains visible as points and receives explicit insufficient-trend guidance. Compact single-day charts also retain their point.
- Tooltips fit phone widths and were tested with pointer and touch input.
- Expandable textual daily averages remain available independently of chart interaction. Units stay visible; no thresholds, target bands, risk labels or analytic findings were invented.

## Actual verification

| Check | Result and evidence |
|---|---|
| Frontend and script TypeScript | `npm run typecheck` passed. |
| ESLint | `npm run lint` passed; new gallery/chart runners also received focused lint checks. |
| Production build | `npm run build -- --configLoader runner` passed. Existing Zod comment-annotation warnings remain non-fatal. |
| Translations | `npm run check:translations` passed: **691 matching keys**, compatible placeholders. Unused/dynamic-key messages remain advisory. |
| Existing smoke/invariants | `npm run test:smoke` passed: 14 route renders plus measurement, medication, habit, report and empty-account invariants. New checks cover calendar gaps, leap days, supplied zero values and non-mutating chart normalization. |
| Route review | [63 route cases](../apps/frontend/artifacts/living-evolution/after/routes.json) plus [35 supplementary responsive cases](../apps/frontend/artifacts/living-evolution/after/responsive.json) passed. No detected horizontal overflow, outside content, font failure, direction mismatch or sampled text-contrast failure. |
| Matching final captures | [42 comparison cases](../apps/frontend/artifacts/living-evolution/after/comparison-report.json) passed; the final assistant images were refreshed by its targeted pass. |
| Final assistant layout | [Eight widths](../apps/frontend/artifacts/living-evolution/after/assistant-layout.json) passed after the final full-width recomposition. |
| Navigation/notifications/consent/recovery | [16 captured state cases](../apps/frontend/artifacts/living-evolution/after/interactions.json) passed: read/unread/loading/error/retry, revoke cancellation/focus/single request, system theme, Motion Off, More, skip link, code selection and recovery validation. |
| Charts and hybrid styling | [Three scenario sets / 21 captures](../apps/frontend/artifacts/living-evolution/charts/report.json) passed at 1440, 390 and 320px: sparse/single/empty data, pressure gaps, glucose fill, exact textual values, touch/pointer tooltips, mini charts and shared spacing. |
| Assistant behavior | [20 checks](../apps/frontend/artifacts/assistant-frontend/report.json): independent CSRF-protected payload, Enter/Shift+Enter, duplicate-send lock, eight failure/retry cases, plain-text safety, long-chat scroll, account/role isolation, no persistence, sidebar preference and simulated 430px VisualViewport composer visibility. |
| Patient workflows | [Three workflow sets / 15 captures](../apps/frontend/artifacts/living-evolution-records/report.json) plus [320px typography guard](../apps/frontend/artifacts/living-evolution-records-token-guard/report.json) passed: measurement/filter, medication edits/dose logging, habit rollback/template identity and report periods. |
| Public/account | [16 representative cases](../apps/frontend/artifacts/living-evolution/public-qa/report.json) and [six password cases](../apps/frontend/artifacts/living-evolution/password-qa/report.json): validation focus, visibility with long input/errors, menu dismissal, safe demonstration controls and RTL geometry. |
| Clinical/admin | [Clinical interactions](../apps/frontend/artifacts/evolution-clinical/after/clinical-report.json), [fresh visual review](../apps/frontend/artifacts/evolution-clinical/after/visual-report.json), and [32-character/RTL checks](../apps/frontend/artifacts/evolution-clinical/after/targeted-report.json) passed. Existing [13-check admin runner](../apps/frontend/artifacts/admin-refinement-phase2c/after/report.json) also passed after adapting it to the creation dialog. |
| Whitespace | `git diff --check` passed. |

The [built-asset preview pass](../apps/frontend/artifacts/living-evolution/production/report.json) also passed 14 desktop/mobile cases across the seven major experiences. The preview was checked against the current built JavaScript asset and confirmed to serve built files without the Vite development client. These are frontend checks with intercepted APIs, not live backend integration tests.

Counts describe distinct scopes and are not summed into a misleading total. The route screenshots were visually inspected in addition to geometry assertions. Issues corrected during review included CSS layer registration order, old password-toggle positioning, full-length code clipping, and the assistant composition remaining too close to 4.0. Test fixtures were corrected to respect the existing authenticated measurement contract; no production parser was weakened.

## Before/after review and backup

- [Interactive gallery: all 42 matching captures](../apps/frontend/artifacts/living-evolution/comparison.html)
- [Seven required desktop/phone comparison rows](../apps/frontend/artifacts/living-evolution/comparison-overview.png)
- [Recoverable source archive before this task](../apps/frontend/artifacts/living-evolution/backup/source-before.zip)
- [Initial pending tracked changes](../apps/frontend/artifacts/living-evolution/backup/pending-changes.patch)

Before captures show the actual rejected 4.0 working tree, not a Git reset to HEAD. After captures use comparable viewport, language, appearance and isolated fixture states. These local artifacts are Git-ignored. No real patient information was used in browser verification.

## Files changed in this task

The list below is compared with the source backup taken at the start of this task, rather than attributing every pre-existing Git modification to Living Evolution.

- [.agents/skills/chroniccare-workflow/SKILL.md](../.agents/skills/chroniccare-workflow/SKILL.md)
- [apps/frontend/index.html](../apps/frontend/index.html)
- [apps/frontend/NEXT_GENERATION_REDESIGN.md](../apps/frontend/NEXT_GENERATION_REDESIGN.md)
- [apps/frontend/scripts/admin-design-browser.mjs](../apps/frontend/scripts/admin-design-browser.mjs)
- [apps/frontend/scripts/assistant-browser.mjs](../apps/frontend/scripts/assistant-browser.mjs)
- [apps/frontend/scripts/evolution-browser.mjs](../apps/frontend/scripts/evolution-browser.mjs)
- [apps/frontend/scripts/evolution-charts-browser.mjs](../apps/frontend/scripts/evolution-charts-browser.mjs)
- [apps/frontend/scripts/evolution-gallery.mjs](../apps/frontend/scripts/evolution-gallery.mjs)
- [apps/frontend/scripts/evolution-records-browser.mjs](../apps/frontend/scripts/evolution-records-browser.mjs)
- [apps/frontend/scripts/smoke.tsx](../apps/frontend/scripts/smoke.tsx)
- [apps/frontend/src/components/charts/PrecisionHealthChart.tsx](../apps/frontend/src/components/charts/PrecisionHealthChart.tsx)
- [apps/frontend/src/components/charts/ReportChart.tsx](../apps/frontend/src/components/charts/ReportChart.tsx)
- [apps/frontend/src/components/charts/TrendChart.tsx](../apps/frontend/src/components/charts/TrendChart.tsx)
- [apps/frontend/src/components/health/HabitCard.tsx](../apps/frontend/src/components/health/HabitCard.tsx)
- [apps/frontend/src/components/health/WeeklySummary.tsx](../apps/frontend/src/components/health/WeeklySummary.tsx)
- [apps/frontend/src/components/layout/BottomNav.tsx](../apps/frontend/src/components/layout/BottomNav.tsx)
- [apps/frontend/src/components/layout/DashboardLayout.tsx](../apps/frontend/src/components/layout/DashboardLayout.tsx)
- [apps/frontend/src/components/layout/NotificationCenter.tsx](../apps/frontend/src/components/layout/NotificationCenter.tsx)
- [apps/frontend/src/components/layout/Sidebar.tsx](../apps/frontend/src/components/layout/Sidebar.tsx)
- [apps/frontend/src/components/public/PublicHeader.tsx](../apps/frontend/src/components/public/PublicHeader.tsx)
- [apps/frontend/src/components/public/PublicLayout.tsx](../apps/frontend/src/components/public/PublicLayout.tsx)
- [apps/frontend/src/i18n/locales/ar.ts](../apps/frontend/src/i18n/locales/ar.ts)
- [apps/frontend/src/i18n/locales/en.ts](../apps/frontend/src/i18n/locales/en.ts)
- [apps/frontend/src/lib/utils/chartSeries.ts](../apps/frontend/src/lib/utils/chartSeries.ts)
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
- [apps/frontend/src/styles/evolution/base.css](../apps/frontend/src/styles/evolution/base.css)
- [apps/frontend/src/styles/evolution/charts.css](../apps/frontend/src/styles/evolution/charts.css)
- [apps/frontend/src/styles/evolution/clinical.css](../apps/frontend/src/styles/evolution/clinical.css)
- [apps/frontend/src/styles/evolution/components.css](../apps/frontend/src/styles/evolution/components.css)
- [apps/frontend/src/styles/evolution/layout.css](../apps/frontend/src/styles/evolution/layout.css)
- [apps/frontend/src/styles/evolution/public.css](../apps/frontend/src/styles/evolution/public.css)
- [apps/frontend/src/styles/evolution/records.css](../apps/frontend/src/styles/evolution/records.css)
- [apps/frontend/src/styles/evolution/tokens.css](../apps/frontend/src/styles/evolution/tokens.css)
- [apps/frontend/src/styles/evolution/workspace.css](../apps/frontend/src/styles/evolution/workspace.css)
- [apps/frontend/src/styles/globals.css](../apps/frontend/src/styles/globals.css)
- [apps/frontend/src/theme/ThemeProvider.tsx](../apps/frontend/src/theme/ThemeProvider.tsx)
- [docs/chroniccare-4-redesign.md](../docs/chroniccare-4-redesign.md)
- [docs/living-evolution-redesign.md](../docs/living-evolution-redesign.md)
- [docs/product-experience-refinement.md](../docs/product-experience-refinement.md)
- [README.md](../README.md)

The pre-existing backend test and frontend environment-example edits remain untouched. Earlier adaptive styles, reports and other pending changes are preserved. No backend code, database schema/migration, API contract, authentication provider, authorization hook, dependency manifest or lockfile was modified by this redesign. No commit or push was made.

## Limits and final review

Completed and browser-verified: every existing route group, the new shared presentation, representative English/Arabic and light/dark layouts, the focused UI workflows above, and simulated visual-viewport resizing.

Completed but not verified on live integrations: real PostgreSQL persistence, actual email delivery/activation, live AI provider responses and FCM registration/delivery. Browser checks intercept API calls; database integration scripts that migrate/create/delete accounts were not run. No paid OpenAI request or live push was sent.

Physical iOS/Android keyboards, browser toolbar/notch behavior, real-device performance and a complete screen-reader/contrast audit remain manual checks. Edge touch/viewport simulation and sampled contrast do not establish complete WCAG 2.2 AA compliance. Existing security architecture was preserved, not re-audited for release.

No route is intentionally left on the rejected identity. Final design approval and the manual device/live-integration checks remain outstanding.

## Local preview

The development preview is [http://localhost:5188](http://localhost:5188). The offline gallery can be reviewed without signing in. To restart from `apps/frontend`:

```powershell
npm run dev -- --port 5188 --strictPort --configLoader runner
```

To preview built assets:

```powershell
npm run build -- --configLoader runner
npm run preview -- --port 5189 --strictPort --configLoader runner
```

The runner loader avoids the local Windows sandbox's configuration-bundling path restriction. Existing Playwright can be supplied through `PLAYWRIGHT_MODULE_PATH`; then run `evolution-browser.mjs --routes-only`, `--responsive-only`, or `--interactions-only`, plus `evolution-charts-browser.mjs`, `evolution-records-browser.mjs` and `evolution-gallery.mjs` from `apps/frontend` using `node scripts/...`.

For manual approval, inspect the gallery and use existing authorized test accounts to review each role, phone navigation, add/edit/cancel forms, consent dialogs, long chat/failures, and physical keyboard behavior. Do not modify real health records merely to review the design.
