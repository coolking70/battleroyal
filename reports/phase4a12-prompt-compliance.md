# Phase 4A-1.2 Prompt Compliance

## Scout v3

- Task revision is 2 and the content hash differs from Scout v2.
- Positive entity semantics anchor the role as an unarmed civilian urban observer.
- Positive composition includes empty hands, empty back/shoulders, binoculars, civilian outdoor clothing, and a civilian shoulder pouch.
- Hard constraints include `UNARMED`, civilian identity, empty hands, visible shoulders, empty upper-back silhouette, no object above either shoulder, no holster, no plate carrier, and no camouflage.
- Positive category/entity sections do not request military scout, tactical operator, armed, sniper, or combat-loadout semantics.

## Blackout v3

- Task revision is 2 and the content hash differs from Blackout v2.
- Positive entity semantics anchor the event to a fully indoor commercial corridor immediately after a power failure.
- Hard constraints include fully indoor, empty corridor, zero people, zero rain, no weather, no exterior street, switched-off normal lights, black screens, and sparse emergency lamps.
- Positive category/entity sections do not describe rain, street battle, survivor, or soldier content.

## Boundary checks

- Bandage and School prompts, tasks, candidates, and prior review packages were not regenerated or modified.
- The overall Render Style remains phase4-style-v2; this is targeted v3 task hardening, not a global architecture v3.
- No vision model, CLIP, OCR, or object detector was added.
- Structural prompt compliance is not human visual approval.
