---
name: ChronicCare AI Homepage Review
description: Arabic homepage preview for a personal health record
colors:
  canvas-light: "#fbfcfd"
  canvas-dark: "#151f27"
  ink-light: "#182832"
  ink-dark: "#ecf3f6"
  body-light: "#415660"
  body-dark: "#bdcdd5"
  divider-light: "#bccbd1"
  divider-dark: "#5c717d"
  plot-bg-light: "#edf3f6"
  plot-bg-dark: "#1e303b"
  accent-light: "#aa351d"
  accent-dark: "#ffa98f"
  on-accent-light: "#fff"
  on-accent-dark: "#27140e"
  accent-hover-light: "#8c2715"
  accent-hover-dark: "#ffbda9"
  accent-active-light: "#731d0e"
  accent-active-dark: "#f69272"
  plot-secondary-light: "#395b70"
  plot-secondary-dark: "#b5d6ea"
  focus-light: "#1c6385"
  focus-dark: "#96d5f0"
  visit-light: "#182b37"
  visit-dark: "#0e181f"
  on-visit-light: "#f4f9fb"
  on-visit-dark: "#f4f9fb"
  visit-muted-light: "#d6e2e8"
  visit-muted-dark: "#cadbe4"
  sheet-light: "#fbfcfd"
  sheet-dark: "#20313d"
  visit-focus-light: "#97d5f1"
  visit-focus-dark: "#97d5f1"
typography:
  display:
    fontFamily: "Review Naskh, Times New Roman, serif"
    fontSize: "clamp(46px, 5.75vw, 82px)"
    fontWeight: 500
    lineHeight: 1.13
  headline:
    fontFamily: "Review Naskh, Times New Roman, serif"
    fontSize: "clamp(41px, 4.6vw, 70px)"
    fontWeight: 500
    lineHeight: 1.15
  title:
    fontFamily: "Review Naskh, Times New Roman, serif"
    fontSize: "clamp(28px, 2.9vw, 42px)"
    fontWeight: 500
    lineHeight: 1.25
  body:
    fontFamily: "Review Sans, Tahoma, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.85
  reading-value:
    fontFamily: "Review Sans, Tahoma, sans-serif"
    fontSize: "clamp(43px, 5.4vw, 76px)"
    fontWeight: 600
    lineHeight: 1.17
  control-label:
    fontFamily: "Review Sans, Tahoma, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.85
rounded:
  control: "7px"
  point: "50%"
spacing:
  section: "clamp(64px, 7vw, 112px)"
  record: "clamp(22px, 3.4vw, 46px)"
components:
  button-primary-light:
    backgroundColor: "{colors.accent-light}"
    textColor: "{colors.on-accent-light}"
    typography: "{typography.control-label}"
    rounded: "{rounded.control}"
    padding: "9px 24px"
  button-primary-light-hover:
    backgroundColor: "{colors.accent-hover-light}"
  button-primary-light-active:
    backgroundColor: "{colors.accent-active-light}"
  button-primary-dark:
    backgroundColor: "{colors.accent-dark}"
    textColor: "{colors.on-accent-dark}"
    typography: "{typography.control-label}"
    rounded: "{rounded.control}"
    padding: "9px 24px"
  button-primary-dark-hover:
    backgroundColor: "{colors.accent-hover-dark}"
  button-primary-dark-active:
    backgroundColor: "{colors.accent-active-dark}"
---

# Design System: ChronicCare AI Homepage Review

## Overview

The Arabic homepage pairs Naskh headlines with a photograph of a blood pressure reading at home. A cool measurements surface and a dark visit section carry the reader from a weekly trend to the record they can review before an appointment.

Scope is the isolated homepage preview. [homepage.css](homepage.css) controls all runtime values, including light and dark themes. The values here describe that implementation for design tooling. [Homepage.tsx](Homepage.tsx) and [Measurements.tsx](Measurements.tsx) define component structure and behavior.

## Colors

| Role | Light | Dark | Use |
| --- | --- | --- | --- |
| Primary | Terracotta | Peach | Registration CTA, selected metric rule, primary chart line and selection background |
| Action text | White | Dark brown | Text on filled primary surfaces |
| Series two | Slate blue | Pale blue | Dashed diastolic series and its direct label |
| Keyboard focus | Blue | Pale blue | Three-pixel outline with a four-pixel offset. The visit section uses its own light blue focus value in both themes. |
| Canvas and text | Near-white, slate ink | Deep slate, near-white ink | Page background and headings, with softened ink for supporting text |
| Measurements | Blue-gray tint | Blue-slate tint | Chart panel and marker interiors, with grid lines in the theme's divider color |
| Visit and record | Dark slate band, near-white sheet | Deeper slate band, raised blue-slate sheet | Appointment guidance on the band, reading rows on the sheet |

## Typography

- Headings use locally hosted Noto Naskh Arabic under the CSS family name Review Naskh, with Times New Roman as the serif fallback. Hero, section and record headings use weight 500. The hero drops to 38px at widths up to 360px. The final section heading uses `clamp(38px, 4vw, 56px)`.
- Body text and controls use locally hosted Noto Sans Arabic under the CSS family name Review Sans, with Tahoma as fallback. Body text is 18px at 1.85 line height. The opening paragraph uses `clamp(17px, 1.52vw, 21px)`, balanced wrapping and a 66-character measure. The wordmark uses Segoe UI, weight 650, and its own English left-to-right direction.
- Give the latest reading tabular numerals and isolate pressure pairs left to right inside the Arabic sentence. Details use Arabic-Indic numbers and show units and time as separate text. Chart and record support labels use the same sans family.
- The fonts are bundled with [the Noto Naskh Arabic OFL](OFL-Noto-Naskh-Arabic.txt) and [the Noto Sans Arabic OFL](OFL-Noto-Sans-Arabic.txt).

## Layout

The RTL page uses a shared centered container with a 1192px maximum and 44px desktop gutters. At 700px it shifts to 20px gutters, stacked visit columns, and a disclosure menu. At 360px the gutters become 16px, record rows stack, and the chart shows only the first and last date labels. The chart retains a bounded label and tick gutter on either side.

The responsive hero image shows an older woman checking an older man's blood pressure at home. Its crop shifts from 2.75:1 on desktop to 1.34:1 on compact screens. Photograph by Vlada Karpovich. [Original photo](https://www.pexels.com/photo/elderly-woman-checking-the-blood-pressure-of-an-elderly-man-5790822/), [Pexels License](https://www.pexels.com/license/).

## Elevation & Depth

The measurements tint, dark visit band, flat record sheet and one-pixel rules provide visual depth. The compact menu layers over the page below the masthead with a divider along its bottom edge.

## Shapes

Controls use a 7px radius. Photography, sections and the record sheet have square edges. Chart dots use circular markers, with a larger filled dot for the final reading.

## Components

### Registration and secondary actions

The registration CTA is a link with a 54px minimum height, white or dark text by theme, and a directionally appropriate arrow. Hover and pressed states use separate theme-specific fills. Keyboard focus uses the shared visible outline. Fill transitions run for 150ms and reduced-motion preferences suppress the transition and smooth scrolling. The secondary action uses underlined text, an accent on hover and a thicker underline when pressed.

### Navigation

Text navigation links underline on hover and have 44px targets. Theme and menu controls use a 44px icon-button target with a tinted hover background and a divider border while pressed or expanded. The compact menu places links in 48px rows.

### Measurements and reading details

The metric choice is a native radio group with an accent underline and a visible focus ring. The latest reading announces changes through a polite live region. Dates progress from right to left, with the latest reading at the left edge. The first line is solid and the secondary pressure line is dashed. Direct labels at the final values and line styles distinguish the series. A caption describes the figure, and the disclosure exposes a captioned table with dates, unit and the same seven sample readings. The example data is labeled as fictional.

### Visit record

The square sheet uses a definition list for labels and values, with horizontal rules between rows and a separate access note. On small screens the timestamps sit below values. Both the record and sharing instructions keep their text aligned to the Arabic reading direction.
