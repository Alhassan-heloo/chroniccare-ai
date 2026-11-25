# ChronicCare AI interaction ownership

Current routes, role guards and server authorization are authoritative. `DESIGN.md` owns visual choices; identity and semantic CSS implement them. Historical prototypes and generated artifacts are outside the maintained application.

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Form | Shared Input and existing schemas/form handlers | Domain API validation | create / edit / consent | smoke and real-service browser scenarios |
| Select/Listbox | Native selects in measurements, habits and preferences | Existing form implementations | native; platform popup geometry accepted | keyboard and locale browser checks |
| Date | Native date/time inputs in filters and medication forms | Local calendar-date utilities | native; platform picker locale accepted | existing smoke and integration tests |
| Scrollbar | Global evolution/base.css | Semantic theme tokens | component geometry only | narrow viewport and enlarged text |
| Toast | Sonner in AppProviders and persistent Feedback | Mutation hooks | success / error / warning | server acknowledgement and browser checks |
| CRUD | Existing role-scoped query/mutation hooks and APIs | Server authorization and validation | inline measurement / modal account creation | smoke and real-service integration |

Patient care puts latest readings and their actual times before today's tasks and the trend. Existing invalidation synchronizes the log and dashboard. Intake buttons distinguish the action from the saved state. Mobile navigation enters document flow when enlarged text would obstruct content.

Doctor queries are scoped by account and patient ID, cancel superseded requests and validate response identity. Failed or revoked requests replace their record. Desktop shows list and record; mobile restores list position and focus on return. Clinical records remain read-only.

Targeted links contain an opaque fragment token. Sign-in carries it in a fragment with an internal return path. Preview grants no access. Close review dismisses the screen and leaves the link eligible for reopening. Reject invitation opens a confirmation that names the permanent effect on that link. The review displays a terminal message for a rejected link. My Doctors remains the place to manage existing access. See [targeted invitation rules and outcomes](docs/patient-connections.md#targeted-patient-invitations).

Admin creation preserves current role authorization and disable behavior. Direct creation produces a masked temporary password and requires a first-login change. Email invitation waits for activation. Both modes explain their actual outcome and grant no patient-record access.

Shared Modal owns focus trapping, Escape and focus return. Shared Input owns labels and hint/error associations. Forms preserve input on error, block duplicate submissions and acknowledge server-confirmed success. Catalogs own both languages; Arabic is RTL and English is LTR. Reduced motion disables transitions.

Week navigation uses local calendar dates and actual counts. The visit summary reuses verified report data and isolates current-day care. Doctor activity exposes stored recording/update times, and period comparison never fills missing days. Admin invitation state and current account state remain separate; closed tokens are never labelled proof of activation.
