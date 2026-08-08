# Phase 4A-4 Audit Fixes

## Scope

Phase 4A-4 stayed outside `src/core/**` and `src/data/**`. Existing save-audit worktree changes were preserved. No existing Character, Zone, Item, Rain or Blackout image was regenerated.

## Fixes applied

- Formalized the eight human-approved B3 item candidates with their exact hashes; the second publish is idempotent and returns `NO CHANGES`.
- Added `event-positive-only` as a separate prompt strategy. E1 prompts do not inherit the generic event negative prompt, do not emit an `Avoid:` section, and keep provider-facing task IDs/entity IDs out of the body.
- Added event-specific provider audits for person/crowd/UI semantics and the four task-specific forbidden/required vocabularies.
- Added the sequential `art:event-e1` runner. It is fixed to the four E1 tasks, concurrency 1, no `--force`, no reroll, and has the first-three/two-content-rejection stop rule.
- Added tests that capture the actual Agnes request body, verify 16:9 routing, assert Rain API calls remain zero, and prove a content rejection is not retried.
- Added report-driven E1 review export with four human checklists and blank Decision/Notes fields.

## Boundary result

E1 generated four technically valid pending candidates. They remain outside the formal Manifest and have not been approved or published. Rain remained at zero API calls.
