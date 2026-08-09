# Phase 4A-1.1 Audit Fixes

## ART-01 — Render/category style pollution

Added a content-free v2 Render Style and separated category style inheritance. Character sheets are now included only for character tasks; zones, items, and events do not inherit character content.

## ART-02 — Hard-constraint coverage

Added explicit near-end hard constraints for Scout, School, Bandage, and Blackout. Runtime character prompts globally prohibit firearm, rifle, bow, melee weapon, and back-mounted weapon content while retaining profession props such as binoculars.

## ART-03 — Prompt compliance and cache isolation

Added prompt compliance tests for category isolation, hard constraints, ordering, UI pollution, style revision, and v2 cache misses. Prompt reports are versioned under `reports/phase4-prompts/phase4-style-v2/`, preserving v1 reports at their original paths.

## ART-04 — Exact review export

Added report-driven review selection. `--report` requires the exact task ID and candidate hash, rejects status mismatches, emits `-v2` filenames, and keeps human Decision/Notes blank. The old Round A export remains unchanged.

No provider, gameplay, approval, publish, or Manifest behavior was changed.
