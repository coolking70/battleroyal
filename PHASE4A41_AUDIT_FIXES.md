# Phase 4A-4.1 Audit Fixes

## Track A

- Approved the four exact user-approved E1 candidate hashes without regeneration.
- Published only the four E1 World Event slots; formal assets increased from 23 to 27.
- Added provenance/runtime tests for five official World Events and preserved Rain as fallback-only.
- Kept the second publish idempotent and verified `NO CHANGES`.

## Track B

- Replaced the vague Scout Injured prompt with a descriptor-locked positive-only brief based on the approved Scout design sheet.
- Added a canary planner that selects only `character/scout/injured`; Fighter, Engineer, Medic and Rain are excluded.
- Added provider audits for reference-image claims, same-character claims, forbidden military/weapon terms, and internal task/entity IDs.
- Added actual Agnes body capture tests and report-driven canary review export.

No `src/core/**` or `src/data/**` file changed. No existing portrait, zone, item, E1 or Rain image was regenerated. Scout Injured was generated once, remains pending, and was not added to the Manifest.
