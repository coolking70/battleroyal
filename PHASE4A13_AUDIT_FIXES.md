# Phase 4A-1.3 Audit Fixes

## Scout — Semantic Reframing

- Added the optional provider-facing descriptor `civilian urban observer` while retaining the internal `character/scout/portrait` task ID.
- Removed the Markdown design-sheet heading before provider injection, so the model does not receive `Scout` as a visual identity label.
- Replaced Scout's positive provider semantics with a 30-year-old civilian observer, plain slate-blue jacket, charcoal shirt, khaki outdoor trousers, binoculars, empty hands, empty shoulders/back, and one side messenger pouch.
- Locked the composition as waist-up and preserved the disallowed military/tactical terms only in hard constraints or AVOID.

## Blackout — Composition Locking

- Replaced free indoor-scene composition with a windowless underground commercial corridor.
- Made dark normal fixtures, black screens, off storefronts, off escalator indicators, and sparse red emergency lamps positive facts.
- Added zero-window/exterior/weather and green-indicator constraints plus unrelated fire/explosion/flooding negatives.
- Kept the shared Event Style phenomenon-first without globally forbidding weather needed by other event tasks.

## Boundaries

- Review export remains report-selected and now supports `--report`, `--output`, and `--suffix` for A4.
- Bandage and School were not modified or regenerated.
- No provider, API contract, cache, validator, approval, publisher, Manifest, or game-core code was changed.
