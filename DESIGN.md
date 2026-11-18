---
name: ChronicCare AI
description: Shared visual system for the public Homepage and authenticated workspaces.
colors:
  paper: "#fbf8f0"
  quiet: "#ebf5f0"
  stage: "#e1ebe5"
  ink: "#102b2d"
  muted: "#3d5354"
  rule: "#c6d5ce"
  accent: "#075b55"
  on-accent: "#fff"
  surface: "#fffdf8"
  surface-raised: "#ffffff"
  control-border: "#718782"
  dark-page: "#151619"
  dark-card: "#202226"
  dark-raised: "#2A2D32"
  dark-text: "#F2F3F5"
  dark-muted: "#C4C8D0"
  dark-divider: "#41444B"
  dark-control-border: "#7D8290"
  dark-accent: "#B59AFF"
  dark-on-accent: "#1B132D"
  dark-chart-glow: "#B08BFF"
typography:
  page-title:
    fontFamily: "Hybrid Naskh, 'Times New Roman', serif"
    fontSize: "2.75rem"
    fontWeight: 400
    lineHeight: 1.2
  body:
    fontFamily: "Hybrid Arabic, Tahoma, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.7
  control:
    fontFamily: "Hybrid Arabic, Tahoma, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
rounded:
  sm: ".625rem"
  md: "1rem"
  lg: "1.5rem"
  pill: "999px"
spacing:
  unit: ".25rem"
  space-3: ".75rem"
  space-4: "1rem"
  space-5: "1.25rem"
  space-6: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.control}"
    rounded: "{rounded.pill}"
    padding: ".75rem 1.5rem"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.pill}"
    padding: ".75rem 1.5rem"
  field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: ".75rem 1rem"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
  dialog:
    backgroundColor: "{colors.surface-raised}"
    rounded: "{rounded.lg}"
    padding: "{spacing.space-6}"
---

# ChronicCare AI Design System

## Overview

The approved integrated Homepage and its hybrid source establish the visual identity. The Homepage uses editorial type, warm paper, quiet mint surfaces and photography of everyday care. The homepage AI assistant section supplies the application reference for light heading weights, 1.7 body leading, quiet surfaces, fine borders, and one clear filled action. Workspace layouts organize those choices around each role’s existing workflow.

[Identity](apps/frontend/src/styles/evolution/identity.css) defines the shared fonts, light palette and pill shape. [Semantic tokens](apps/frontend/src/styles/evolution/tokens.css) connect that identity to application components and chart roles. [Dark palette](apps/frontend/src/styles/evolution/dark-palette.css) supplies the app and hybrid preview’s dark values. The [living stylesheets](apps/frontend/src/styles) carry those roles into existing page-specific layouts.

## Colors

- In light mode, use warm paper for the page and form fields, neutral ivory (#fffdf8) for forms, tables and ordinary cards, and white for raised dialogs. Reserve quiet mint for the latest-readings summary, the auth story and selected items. The semantic --summary-surface token owns that emphasis. Deep teal marks primary actions and focus. Use the control border to identify fields and the lighter rule to divide content.
- In dark mode, use charcoal for the shell, lighter charcoal for cards and raised surfaces, and lavender for actions and focus. Pair lavender fills with dark accent ink. The separate chart glow belongs to the dark chart treatment.
- Use semantic tokens for feedback and chart series. Keep chart values, units and dates legible in both themes.

## Typography

The locally bundled Noto Naskh Arabic appears as `Hybrid Naskh` and gives prominent headings their editorial shape at weight 400. Application page titles are 44px on desktop and 36px on narrow screens. Noto Sans Arabic appears as `Hybrid Arabic` and handles body text, controls and workspace details. Use tabular digits for recorded values and keep mixed-direction identifiers readable with local direction isolation.

## Layout

The workspace uses a quarter-rem rhythm, a responsive page gutter and content capped at 83rem. The desktop sidebar condenses to an icon rail from 48rem through 74.99rem. Below 48rem, role-specific bottom navigation replaces the sidebar, form grids stack and space is reserved for mobile navigation and safe-area insets. Use logical properties to follow Arabic RTL and English LTR reading order.

## Elevation & Depth

Use surface tone and a fine border for resting cards. Raised dialogs have a stronger border, a shadow and a dim backdrop. Fixed mobile navigation has its own subtle shadow.

## Shapes

Use rounded controls, slightly wider card corners and larger dialog corners. Filled primary actions use the pill radius. Secondary actions use a fine outline and pill shape. Inputs keep smaller corners. Icon actions use a 44px circular hit area with a consistent 1.8px stroke.

## Components

- **Page headings** use a clear title and supporting description with a divider beneath them. [PageHeading](apps/frontend/src/components/ui/PageHeading.tsx) can place an action alongside its copy. The [patient page header](apps/frontend/src/components/layout/PatientPageHeader.tsx) keeps the greeting and record action adjacent on desktop and stacks the action at full width on small screens.
- **Actions and forms** use one filled style for the primary action and outlined styling for secondary actions. Destructive confirmations use the shared danger variant, preserving the same dimensions and focus treatment. Fields have persistent labels, visible borders and inline validation. Keyboard focus uses a 3px outline. Hover and press feedback is brief, and reduced-motion preferences disable transition and animation effects.
- **Dialogs** use a centered, scrollable panel on larger screens and a bottom sheet below 48rem. The header keeps the title and close action visible as the body scrolls. The shared fields and feedback styles apply to modal forms.
- **Patient workspace** puts latest readings and the record-pressure action first. Both latest readings sit above one chart on the page background with quiet horizontal dividers. Below 480px, summary readings stack into full-width rows. Values and units stay together with tabular, direction-isolated numerals; the timestamp follows in the same reading group. A reading-log container query stacks enlarged rows when the available width falls below 14rem; a unit may move directly below its number within the same group, retaining legibility at 320px with 200% text. The measurement log comes before its optional trend chart; filters sit beside the log heading, and mobile entries pair the name/time with an atomic value/unit. **Doctor workspace** organizes connections and shared patient records around patient selection. **Administrator workspace** presents the doctor list as a ledger on desktop and reflows the entries on small screens. Account creation and confirmation use the shared dialog pattern.


## Shared ownership

[BrandIdentity](apps/frontend/src/components/ui/BrandIdentity.tsx) renders the same pulse mark and Segoe UI wordmark inside the public and application navigation links. The homepage keeps its existing composition.

[AppearanceControls](apps/frontend/src/components/ui/AppearanceControls.tsx) renders theme and language buttons. [PreferencesButton](apps/frontend/src/components/layout/PreferencesButton.tsx) owns the same accessible preferences dialog for authentication and all three workspace roles. The existing theme provider still owns light, dark and system settings.

The application locale catalogs own the action and destination labels. [The homepage label adapter](apps/frontend/src/i18n/brandLabels.ts) reads them for the standalone homepage. Patient navigation uses the same My care destination label as the homepage account action.

## Responsive homepage navigation

The approved hybrid source remains the root homepage and standalone preview. Its header measures the natural brand, section links and account controls against the available header width after fonts and locale changes. A ResizeObserver replaces the old 1280px visibility cutoff. Compact navigation keeps every section and the appropriate guest, patient, doctor or admin workspace destination available. When resizing hides a focused inline link, focus moves to the menu trigger. Escape closes the menu and restores focus. Legacy section hashes resolve after local fonts settle, using an immediate initial jump so mobile browser restoration cannot interrupt arrival; existing current-section scrolling remains intact. Narrow workspace labels may wrap inside the account action rather than overflowing the viewport.

The hero, photography, ECG, autoplaying curve chart, gallery and assistant example retain their existing interactions. Homepage section titles follow the assistant's light editorial heading weight. The same localized “المساعد الذكي” / “Health assistant” name identifies the public example, workspace heading and navigation.

## Verification ownership

Frontend navigation regression lives in scripts/homepage-navigation-browser.mjs (npm run test:homepage-navigation). It uses explicitly mocked API responses and covers both locales/themes, four session roles, fitting/collapsed widths, destination links and focus across resizing. Real-service integration scripts remain separate; their dedicated test accounts and test-database guards are preserved. Browser suites isolate Vite dependency caches from the running preview. scripts/smoke.tsx explicitly asserts the trend disclosure match exists before checking its index, preserving the log-before-trend assertion and satisfying strict TypeScript.
