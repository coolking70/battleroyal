# Phase 4A-4.2 Injured Production Specification

## Strategy

`descriptor-locked text-only` is the approved strategy. Scout Injured passed human review in the previous phase, so the strategy was extended to Fighter, Engineer and Medic. Agnes remains text-to-image only: no approved portrait bytes, reference image, img2img or image-conditioned request is sent.

Each task is `character-positive-only`, revision 2, 768×1024 requested at 3:4. Agnes may return 864×1152, which is accepted by the existing validation contract. The positive prompt contains the approved base visual identity, provider descriptor, mild injury state and shared waist-up/three-quarter composition. `negativePrompt` is empty.

## Allowed state changes

- slight fatigue, light dust or a small clothing scuff;
- one small adhesive dressing or similarly minor first-aid treatment;
- a restrained tired, tense or strained expression;
- no severe injury narrative and no occupational identity redesign.

## Production controls

- Order: Fighter → Engineer → Medic.
- Concurrency: 1.
- Maximum API calls: 3 total, one per task.
- Retry and reroll: disabled.
- Two consecutive provider content rejections stop the remaining calls.
- New candidates remain `review=pending`; there is no auto-approval, rejection, similarity score or publish step.
- Rain, combat variants, base portraits, Zones, Items and World Events receive zero calls in this phase.

## Human review standard

Review asks whether a player would naturally read the base and injured portraits as the same game character. It does not require identical facial features, pixels or pose. The review package leaves Decision and Notes blank for the user.
