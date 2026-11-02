# Focused Phase 2C foundation

The original academic proposal is unavailable. Available implementation documents
confirm Admin Doctor listing/creation, bootstrap/invitation and role isolation;
they do not authorize speculative Admin tools. No new Admin capability was added.

This step fixes the synchronous-submit gap in Doctor creation: a ref lock spans
the pending request so repeated submissions before React re-renders cannot start
another mutation. Existing confirmed-success/error feedback and the database's
unique email constraint remain unchanged.

Shared primitives, available to every role:

- `Input` composes external aria-describedby references, optional hint text and
  validation errors without losing or duplicating their IDs. Admin's password
  instructions now reference the actual input while keeping its visibility button
  positioned as before.
- `Card padding="comfortable"` opts into the existing 24px desktop / 18px mobile
  spacing. The default Card is unchanged. Only Admin's create form opts in here.

Ocean Graphite/theme tokens, Cairo, shared navigation, Tidal Weave and Living
Pulse are reused as-is. This task introduces no new animation, palette, font,
dependency, backend change or database migration.

Next stage: obtain the approved Admin requirements before adding capabilities;
incrementally adopt these primitives and review shared headers/navigation across
roles in the later unified-design pass. Do not treat this step as a full-site
visual review. Existing uncommitted work is preserved; no commit/push.
