# ChronicCare AI v1.0.0

**Proposed GitHub Release title** · ChronicCare AI v1.0.0 — Graduation Project Release

ChronicCare AI is a bilingual web application for recording day-to-day health information and sharing selected records with an explicitly approved doctor. This graduation release documents the application running at [ChronicCare AI](https://chroniccare-ai-api.onrender.com/) from commit `bb99da73326d5a513343b001f4050105729a051b`.

## Highlights

- **Patient workspace** · Blood pressure and glucose logs, medication schedules and dose tracking, habits, descriptive trends, and a printable visit summary.
- **Doctor workspace** · A list of patients who granted access, a read-only record, and recent activity. Access depends on the patient's consent and is removed on revocation.
- **Administration** · Doctor account creation and activation, invitation history, and account disablement. Administration and clinical access are separate roles.
- **Decisions on invitations** · Close review leaves a link available while eligible. Permanent rejection consumes the targeted link and blocks replay. Rejection of a new link preserves earlier consent. Arabic RTL and English LTR are supported.
- **Educational assistant** · An authenticated patient can submit a bounded question to a configured provider. The application supplies safety notices, handles provider failures, and sends no automatic patient-record context.
- **Responsive web experience** · Arabic and English, light and dark appearance, mobile layouts, and an installable HTTPS web shell where supported.

## Upgrade and verification

Migration 018 adds a rejected flag and a validated consistency constraint to targeted invitations. It was applied and verified separately before this application build went live. The same-origin Render service serves the interface and API. Its current startup command runs the application, with schema changes handled separately. [Deployment guide](docs/render-same-origin.md)

The release review recorded 116 successful backend checks, focused Edge suites for invitations, connections, doctor/admin access and authentication, and 20 checks against the production-style HTTPS build. Production received anonymous readiness, access-denial and navigation checks. See [Final Project Status](FINAL-PROJECT-STATUS.md) for exact counts, evidence sources and remaining gaps.

## Release scope

The assistant is for general education. This academic project has no established clinical validation, diagnostic performance, healthcare regulatory certification or patient-outcome evidence. Production role-based sessions, live AI/email/push delivery, and physical devices were outside the final production smoke-test scope.

## ملخص الإصدار

يجمع الإصدار متابعة المريض اليومية، وقراءة الطبيب للسجل بعد موافقة صريحة، وإدارة حسابات الأطباء، ومساعدًا للتثقيف الصحي. يفصل بين إغلاق مراجعة الدعوة ورفضها نهائيًا، ويوثّق حدود التحقق قبل اعتماد الإصدار الأكاديمي.

[Project README](README.md) · [Graduation demo](GRADUATION-DEMO.md) · [Portfolio case study](PORTFOLIO-CASE-STUDY.md) · [Final acceptance](FINAL-ACCEPTANCE.md)
