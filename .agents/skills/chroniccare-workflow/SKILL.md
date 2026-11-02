---
name: chroniccare-workflow
description: Guide development tasks in the ChronicCare AI project with focused inspection, minimal complete changes, and risk-based validation while preserving existing architecture and behavior.
---

# ChronicCare Workflow

1. Identify the requested outcome, scope, and acceptance criteria before editing. Clarify only material ambiguities that project context cannot resolve.
2. Inspect only relevant files and their direct dependencies. Use targeted searches; reuse findings from the current task and rescan only when changes or new evidence warrant it.
3. Preserve working functionality and existing user changes. Reuse the current React, Express, and PostgreSQL architecture and established project patterns.
4. Implement the smallest complete solution that satisfies the acceptance criteria. Avoid unrelated refactors, dependencies, and speculative improvements.
5. Run focused checks based on the affected behavior and actual risk. Honor required project checks; broaden testing when failures, shared changes, or unresolved risks justify it. Repeat passed checks only after relevant changes or new evidence.
6. Use browser verification when needed for affected user flows; avoid unnecessary full-site reviews.
7. Report completed work, validation results, and remaining issues or blockers. Stop when acceptance criteria are satisfied; do not invent follow-up work.

Preserve Living 3.3, security controls, authentication, patient data, and role permissions. When a task touches these, inspect the relevant existing rules and verify the affected invariants.

Never commit or push to GitHub. Never delete existing accounts or medical data.
