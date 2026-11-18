# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary — patients managing a chronic condition.** They need to record daily measurements, keep track of medications and habits, and understand what their own records show over time.
- **Secondary — doctors following connected patients.** They need to find an authorized patient and review the records the patient has agreed to share.
- **Administrators** manage accounts and doctor access to the platform through a separate workspace.

## Product Purpose

ChronicCare AI helps patients keep up with everyday health routines and review their recorded history. A successful experience makes it easy to log a reading, check a medication or habit, review a trend, and see who has access to the record.

## Positioning

The patient workspace brings daily tracking, descriptive reports, and optional doctor follow-up together. A doctor shares a connection code. The patient reviews the request and grants read-only access to measurements, medications, and habits. The patient can revoke that access while keeping their records.

## Capabilities and Constraints

- Patients can track measurements such as blood pressure and glucose, manage medications and habits, and review descriptive reports.
- The educational assistant answers general questions. Keep its scope distinct from clinical assessment, diagnosis, and treatment decisions. Do not imply that it automatically reads patient records.
- Patient, doctor, and administrator workspaces require authentication and enforce role-specific permissions. Preserve the existing authorization, consent and revocation flows, integrity of patient records, and API contracts.
- Product copy must accurately describe current capabilities. A doctor account does not establish verified medical licensure.

## Brand Commitments

The product name is **ChronicCare AI**. Living Evolution is the project's established frontend direction. Its implementation and source references are recorded in [the redesign notes](docs/living-evolution-redesign.md).

## Evidence on Hand

- [Application routes](apps/frontend/src/app/routes.tsx) and [product copy](apps/frontend/src/i18n/locales/en.ts) document the workflows and their boundaries.
- [Consent and account documentation](docs/production-account-foundation.md) records how authenticated access and revocation work.
- The public product preview illustrates workflows. Keep demonstration content identifiable and separate from patient records and clinical evidence.

## Product Principles

1. Prioritize the patient's daily tasks and make the next action easy to find.
2. Keep sharing explicit and reversible. Show patients what a doctor can read and who currently has access.
3. Present recorded values, units, dates, and trends clearly. Describe what the records contain without adding medical conclusions.
4. Preserve the patient's ability to complete essential tasks in both supported languages and on small screens.

## Accessibility & Inclusion

Support Arabic in right-to-left layouts and English in left-to-right layouts. Preserve readable mixed-direction text, keyboard navigation, visible focus, reduced-motion preferences, and responsive layouts for daily patient use.
