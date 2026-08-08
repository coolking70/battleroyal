# Phase 4 Prompt Architecture v2

## Scope

Phase 4A-1.1 only revises prompt architecture and regenerates the four Phase 4A-1 Round A assets. It does not change gameplay, the provider adapter, approvals, publication, or the formal asset Manifest.

## Prompt layers

Every prompt is assembled in this order:

1. Render Style: visual rendering language only; no location, role, object, event, character, or interface content.
2. Category Style: the isolated character, zone, item, or event composition policy.
3. Entity Brief: the task brief, plus a character design sheet only for character tasks.
4. Variant: the requested slot variant.
5. Technical composition: dimensions and basic legibility requirements.
6. Hard Composition Constraints: task-specific constraints near the end of the prompt.
7. AVOID: generic negative terms plus category-specific negative terms.

The style profile version is derived from the v2 render/category/constraint/avoid sections. A change in those sections changes the content hash and therefore cannot reuse a v1 cache entry.

## Category inheritance matrix

| Category | Character sheet | People allowed | Environment allowed | Required isolation |
| --- | --- | --- | --- | --- |
| Character | Yes | One adult subject | Unobtrusive background only | No runtime weapons or interface |
| Zone | No | Zero | Yes | Empty environment and calm lower center |
| Item | No | Zero | No | Exactly one centered object on neutral backdrop |
| Event | No | Zero | Yes | Illustration only, no card/interface |

Category negatives remain separate from the generic negative prompt so a category cannot inherit unrelated scene content. Hard constraints are explicit positive/negative render requirements and are kept distinct from the avoid block.

## v1 issue mapping

- Scout: remove rifle/sniper implications; binoculars are the only prominent equipment and hands/back/shoulders are weapon-free.
- School: environment-only with zero humans, silhouettes, HUD, or lower-center obstruction.
- Bandage: one centered isolated object with a neutral backdrop and no ruins, scenery, character, or interface.
- Blackout: environment-only, zero people/weapons/rain, powerless ordinary lights, and sparse red emergency lamps.

Human review remains the authority for visual compliance. No v2 candidate is approved or published by this phase.
