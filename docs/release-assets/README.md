# Graduation release assets

The screenshots show the built ChronicCare AI interface rendered in Microsoft Edge against a loopback-only static server. Browser API responses were intercepted and filled with fictional fixtures. The capture used isolated browser contexts, blocked external traffic and service workers, and used no real accounts, database, tokens, email, push or AI provider. Visible readings, names and timelines are for illustration only. The screenshots demonstrate UI states. [Separate test and deployment evidence](../../FINAL-PROJECT-STATUS.md)

## Screenshots

| Asset | Suggested use |
| --- | --- |
| [English public home](screenshots/home-en.png) | Portfolio hero and opening screenshot. Desktop, light appearance. |
| [Arabic patient dashboard](screenshots/patient-dashboard-ar.png) | Desktop patient workspace, recent readings and daily context. |
| [Arabic mobile patient dashboard](screenshots/patient-mobile-ar.png) | Mobile responsive layout and RTL text. |
| [English doctor record](screenshots/doctor-record-en.png) | Read-only record, doctor workspace and dark appearance. |
| [Arabic invitation review](screenshots/invitation-review-ar.png) | Mobile review with clear approval, dismissal and rejection actions. |
| [English rejection confirmation](screenshots/invitation-confirmation-en.png) | Mobile confirmation for the permanent link decision. |

## Diagrams

| Diagram | What to explain |
| --- | --- |
| [System architecture](diagrams/system-architecture.drawio) · [PNG](diagrams/system-architecture.drawio.png) | Browser roles, the same-origin Render service, Neon and optional providers. |
| [Database relationships](diagrams/database-relationships.drawio) · [PNG](diagrams/database-relationships.drawio.png) | Ownership, identity, approval and invitation state. This logical view excludes ancillary tables. |
| [Invitation consent](diagrams/invitation-consent.drawio) · [PNG](diagrams/invitation-consent.drawio.png) | Preview, close, approval, rejection and revocation. |

Use these assets in place of production application screenshots. Review any new capture for identity fields, URL fragments and credentials before sharing. The repository's pre-existing test artifacts and recovery reports remain private.

The homepage and patient views include credited stock photography from the application. Keep the credits with the release and caption stock subjects as illustrative imagery, without implying they are patients, users, or endorsers. Publication remains subject to the owner's confirmation of rights for the repository and captions. [Image credits](../../apps/frontend/homepage-hybrid/DESIGN.md) · [Pexels license](https://www.pexels.com/license/)

**ملاحظة** · جميع الأسماء والقراءات في الصور خيالية. ملفات Draw.io قابلة للتحرير، وصور PNG جاهزة للإدراج في العرض.
