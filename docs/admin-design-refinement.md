# Admin Dashboard — focused Living 3.3 refinement

The page now opts into the existing Living shell only for `/admin/dashboard`.
Patient/Doctor route conditions, APIs, query hooks, validation and the synchronous
submission lock are unchanged. No backend/auth/database files are modified here.

The design uses existing Ocean Graphite light/dark tokens, Cairo, static Tidal
Weave (`SignatureArtwork`) and user-triggered Living Pulse confirmation. Account
count/access boundaries form a compact strip, with a distinct creation surface
alongside a quieter Doctor list. Navigation links jump to keyboard-focusable
section headings. The layout collapses to one column, preserves RTL and long
email wrapping, and inherits the shared focus, Motion Off and reduced-motion
rules. Helper copy describes sharing credentials privately rather than server
implementation details.

Files for this task: AdminDashboard.tsx, admin.css, the Admin-only condition in
DashboardLayout.tsx, one Admin copy value in each ar/en catalog, this note and
scripts/admin-design-browser.mjs. Shared visual components themselves are reused
unchanged. React guidance kept rendering derived from query data, without extra
effects, new caches or dependencies.

Verification: frontend TypeScript/ESLint, 610-key translation check, smoke tests
and production build. The focused Edge script covers validation/focus, password
visibility, pending/confirmed creation, exact existing API payload, list refresh,
empty/error/retry, keyboard use, desktop English dark, mobile Arabic light,
320px overflow, and reduced motion/Motion Off. Only two screenshots are captured.
API responses are explicit fixtures: no real database integration is claimed and
no existing account or patient record is touched. Artifacts are under
apps/frontend/artifacts/admin-design. Existing uncommitted work is preserved;
no commit or push. No other page redesign or full-site visual audit was done.

## Phase 2C density pass — 2026-11-02

Current refinement changes only `AdminDashboard.tsx`, `admin.css`, the focused
browser script and this note. The component change moves the password hint below
both password fields, preserving its aria-describedby link, field order, submit
lock and original API hooks. Scoped CSS pairs fields on desktop, stacks them on
mobile, compacts the header, and expands the existing sidebar item into a readable
horizontal icon/label. The Doctor list now has a surface proportionate to the
creation form. No shared component or role rules are changed.

Desktop concept (mirrored by RTL):
```
header: brand / page identity / preferences / session
sidebar | compact heading + section links
        | account count / access scope
        | create form (2 field columns) | Doctor list
```
The alternative of equal-height panels was rejected: it would reintroduce empty
space when only a few Doctors exist. Each panel instead sizes to its own content.
The established Graphite #0b1320, Ocean #162437, Aqua #69e1d7, light canvas
#f1f5f9 and Cairo are retained. Static Weave and existing Pulse remain unchanged.

Actual checks: frontend TypeScript, ESLint, production build (2444 modules), and
git diff --check passed. Edge passed 13 focused checks before and after, with
explicit API fixtures and no real account/database writes. Captures cover Arabic
RTL desktop dark (1440px) and mobile light (390px); English LTR behavior,
320px overflow, keyboard order, errors/retry, validation, password visibility and
confirmed creation were also checked. Existing backend/auth code was not tested
again because it was not changed. No exhaustive screenshot matrix was run.

Before: `apps/frontend/artifacts/admin-refinement-phase2c/before/`.
After: `apps/frontend/artifacts/admin-refinement-phase2c/after/`.
Both contain screenshots and report.json. The old Playwright runtime path had
disappeared; verification used the already-installed current Codex runtime,
without adding a dependency. Screenshots were visually reviewed.
