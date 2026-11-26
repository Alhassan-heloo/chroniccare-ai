# Graduation Demonstration

**ChronicCare AI v1.0.0** · Alhassan Heloo

**Core story** · A patient records a reading, decides who can see it, and can withdraw access later.

[Public site](https://chroniccare-ai-api.onrender.com/) · [Project and deployment status](FINAL-PROJECT-STATUS.md)

## Setup and fallback

For interactive actions, use the **local synthetic demo**. Use the live site for the public page and anonymous readiness. Have the editable diagrams and screenshots open locally before the session. [Presentation assets](docs/release-assets/README.md)

1. Install the locked dependencies and configure the local backend environment following the [README](README.md#local-development). Keep an ordinary development database and the demo database distinct.
2. On Windows, build the backend and start the repository's demo wrapper. The wrapper owns a loopback PostgreSQL cluster on `5547` and creates a disposable synthetic test database for each run. Point `PG_BIN` at the local PostgreSQL binaries if the default PostgreSQL 18 installation path differs.

   ~~~powershell
   npm.cmd --prefix apps/backend run build
   npm.cmd --prefix apps/frontend run demo:final
   ~~~

3. Read the generated access instructions privately under the ignored frontend artifacts. Keep the credential file, browser URL fragments, account identifiers and clipboard off the projected screen. Sign in ahead of time in separate browser profiles for patient, doctor and admin. Keep the doctor and patient windows side by side. Use the deliberately unlinked demo patient for the consent demonstration.
4. Add a fictional reading to that patient or pre-stage it. Prepare two different targeted links for the same demo patient just before the presentation, within the ten-minute validity window. Use link A for rejection and link B for approval. Capture email locally if demonstrating account activation. Do not send real email or push notifications.
5. If the demo server is unavailable, use the screenshots and diagrams and identify the screenshots as UI captures with fictional responses. Use the saved integration evidence to explain persistence, concurrency and rejection behavior.

For a future local reboot, stop the preview with Ctrl+C and restart the same command to provision a separate synthetic run. Stop the owned PostgreSQL demo cluster only when finished with it, from the repository root:

~~~powershell
node apps/frontend/scripts/final-postgres.mjs --stop
~~~

## Three-minute demonstration

| Time | Show | Arabic cue | English cue |
| --- | --- | --- | --- |
| 0:00–0:25 | Homepage, then patient dashboard | «يجمع المشروع القراءات والجرعات والعادات في مكان واحد استعدادًا للزيارة.» | “The patient brings readings, doses and habits together before a visit.” |
| 0:25–0:55 | Save a fictional pressure reading, then show its value and exact time | «هذه قراءة توضيحية. يظهر وقت حفظها في السجل ونظرة اليوم.» | “This fictional reading keeps its original time in the log and daily view.” |
| 0:55–1:40 | Review link A, close and reopen it, then confirm Reject. Reopen to show the rejected state. Show that the doctor still has no record access. | «المعاينة لا تمنح الوصول. الإغلاق يسمح بالعودة. الرفض يستهلك الرابط نهائيًا.» | “A preview grants no access. Closing lets me review again. Rejection consumes this link.” |
| 1:40–2:25 | Open link B, approve, then show the doctor's read-only record and the same reading. | «الموافقة الصريحة على دعوة جديدة تتيح للطبيب قراءة السجل. تبقى الكتابة للمريض.» | “Explicit approval of a fresh invitation enables this doctor to read the record.” |
| 2:25–3:00 | Open My Doctors or the consent diagram, then summarize limits | «يستطيع المريض سحب الوصول. أثبتنا المسار برمجيًا؛ المشروع للتسجيل والتثقيف، ويحتاج تقييمًا سريريًا مستقلًا.» | “The patient can withdraw access. We verified the software workflow. Clinical evaluation is outside this project.” |

**Short fallback** · Show the Arabic invitation screenshot and English rejection dialog, then use the consent diagram to narrate the transition from no access to approved read-only access. Link the actual integration results while keeping mocked visuals distinct from database evidence.

## Graduation defense · 12–15 minutes

| Segment | Demonstration and evidence |
| --- | --- |
| 0:00–1:00 · Purpose | State the design goals. Reduce fragmented daily recording, preserve timing and units, and give patients control over sharing. Explain how failure, validation and empty states appear. |
| 1:00–3:00 · Patient workspace | Enter one fictional reading and open its date in the log. Show medication dose state and habit progress. Open the visit summary and browser print view. Point out the period and counts before describing trends. |
| 3:00–6:00 · Consent and security | Use link A for close/reopen and permanent rejection. Demonstrate failed reuse with the same user. Open link B, approve, and refresh the doctor view. Revoke in My Doctors, then demonstrate direct-record denial from the doctor side. Explain that the server checks ownership, role and consent on each read. |
| 6:00–7:30 · Doctor and admin | Show the doctor's read-only activity view. In the admin profile, explain email invitations and temporary-password provisioning. Show the synthetic invitation state and distinguish issuance from activation. |
| 7:30–9:30 · Architecture and schema | Display the system and database diagrams. Explain the same-origin deployment, session cookie, CSRF and Neon. Show the two distinct tables for invitations and relationships. Walk through transactional rejection and the schema compatibility of migration 018. |
| 9:30–11:00 · Assistant and UX | Show the educational/privacy notice, bilingual UI, mobile layout and keyboard focus. Use a clearly labelled mocked response if needed. Explain what is sent to a provider and how failures surface. |
| 11:00–14:00 · Verification and limits | Show the live SHA, readiness status, local test counts and the failure boundary of the older account suite. Explain the distinction between HTTP health and migration verification. Close with remaining clinical, privacy, accessibility-device and scale evaluation. |

## Technical achievements and decisions

- Express serves a compiled React frontend and the API on one HTTPS origin. Cookies, CSP and deep links were checked against built output.
- Domain data and consent use PostgreSQL constraints and explicit parameterized queries. Roles with record access are checked in the API and SQL, in addition to the frontend route guard.
- Approval and rejection share one transaction design, protect concurrent decisions and mark the same hashed targeted link consumed. Revocation is separate and cannot resurrect an old link.
- The migration ledger checks names and hashes under an advisory lock. An earlier compatibility rehearsal verified one application of 018, rollback safety, and a previous server running with the added schema.
- Arabic RTL, English LTR, mobile navigation, keyboard focus, reduced motion and light/dark appearance were exercised in browser tests. The scope is recorded in the [status report](FINAL-PROJECT-STATUS.md).

## Committee questions

| Question | Recommended answer |
| --- | --- |
| What problem does the project solve? / ما المشكلة؟ | It combines daily tracking and visit preparation with clear control over what an approved doctor can read. The capstone measures engineering behavior and demo readiness. |
| Does opening an invitation share the record? / هل فتح الرابط يمنح الوصول؟ | The API previews the doctor identity only for the intended account. It grants access when a valid approval creates or records a consented relationship. |
| What if approve and reject race? / ماذا يحدث مع طلبين متزامنين؟ | Both decisions acquire a per-patient transaction advisory lock and lock the invitation row. The winning transaction consumes the link, and the later request sees that state. Repeating an eligible rejection is safe. |
| Is rejection the same as revocation? / هل الرفض هو السحب؟ | Rejection affects that link. Revocation removes existing record access. Either workflow leaves an already consumed link unusable. |
| How do you block direct API access? / كيف تمنعون تجاوز الواجهة؟ | The API validates the session and role, then queries by ownership or by an approved doctor-patient relationship. Cookie writes also use trusted Origin and CSRF checks. |
| What reaches the AI provider? / ما الذي يصل إلى مزوّد الذكاء الاصطناعي؟ | A user-submitted question with language and fixed instructions. The assistant does not fetch the clinical records or send prior turns. Typed free text can still be sensitive. Output may be inaccurate and supports general education only. |
| What happens if AI, email or push is unavailable? / ما أثر تعطل خدمة خارجية؟ | Their workflows report unavailable or failure states. Core records and consent use the separate application and database path. This release did not establish live delivery rates or provider answer quality. |
| Why serve one origin? / لماذا أصل واحد؟ | The same HTTPS origin carries the frontend and API, simplifies browser session behavior, and uses one deployed ingress policy. Express handles API errors distinctly from React deep links. |
| Why migrate before deployment? / لماذا نُفّذ الترحيل أولًا؟ | The new API needs the rejection column. The previous build already understands consumed links, so the additive schema was compatibility-tested before the app switched. The ledger and the readiness endpoint answer different questions. |
| How much was tested? / ما نطاق التحقق؟ | Cite exact local and public-surface checks in the status report. Physical devices, authenticated production sessions, provider delivery and clinical outcomes need separate evidence. |

**Closing line** · “The project demonstrates a traceable path from what a patient records to what a doctor may read, with clear limits on clinical claims.”

**بالعربية** · «قيمة المشروع في ربط سجل المريض اليومي بموافقة واضحة وقابلة للسحب، مع توثيق حدود الاختبار والاستخدام.»
