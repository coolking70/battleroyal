# Phase 4A-4.3.2 Combat Posture-Only Strategy

## Failed strategy history

Scout Combat v1 generated duplicated binoculars: one pair near the face and another on the chest. Scout Combat v2 repeated the same failure despite explicit single-prop, same-instance and strap-transition semantics. The signature-prop position transition is therefore abandoned after 2/2 failures.

## Posture-only hypothesis

This phase tests one variable: keep the signature binoculars static and express Combat entirely through the person.

The provider-facing strategy remains descriptor-locked, text-only and dynamic-equipment-neutral, with the presentation mode:

`posture-only`

The static prop is positive identity anchoring, not a dynamic equipment state. The prompt describes one compact binocular pair naturally hanging at the center of the chest on a simple neck strap, resting in its normal position. Both hands are away from the binoculars and empty.

Combat readability comes from:

- forward torso weight shift;
- raised, tense shoulders;
- a slight head turn and sharply focused gaze;
- one open palm ready to react;
- the other hand lower and empty;
- subtle jacket hem and sleeve motion.

The Scout remains an ordinary civilian urban observer. No weapon, armor, inventory, military or tactical loadout is fixed into the character image.

## Stop rule

This is the final Scout posture-only canary. It is limited to one API call and stops at human review. If a future review still finds duplicate props, weapons, weak action readability or identity drift, do not generate Combat v4; move to the Phase 4A-4.3R design simplification decision instead.
