# Phase 4A-1.2 Audit Fixes

## Scout targeted hardening

- Raised the Scout task revision from 1 to 2.
- Reframed the positive identity as an unarmed civilian urban observer with binoculars, a simple neck strap, lightweight civilian outdoor clothing, a small shoulder pouch, empty hands, and an empty upper-back silhouette.
- Added visible composition requirements for both hands, both shoulders, the upper back, and no object extending above either shoulder.
- Added targeted hard constraints and category negatives for gun, holster, plate carrier, chest rig, ammunition pouch, camouflage, and military/tactical semantics.
- Kept the global v2 render/category architecture and did not add military language to Character Style.

## Blackout targeted hardening

- Raised the Blackout task revision from 1 to 2.
- Replaced street-oriented positive semantics with a completely empty indoor commercial corridor immediately after a recent sudden power failure.
- Added indoor-only, no-weather, no-exterior-street, dark-screen, powerless-light, and sparse-red-emergency-lamp constraints.
- Strengthened the shared event style to environment-first, with no protagonist-focused composition while retaining event props for future broadcast/alert tasks.

## Review/export boundary

- Review export now accepts `--output`, `--suffix`, and a report-selected exact candidate set.
- A3 export uses `output/art-review/phase4a12-round-a3/` and `-v3` filenames.
- Scout and Blackout checklists are human-only checkboxes; Decision and Notes remain blank.

No provider, API request format, cache, validator, approval lifecycle, publisher, Manifest, VisualImage, or game-core code was changed.
