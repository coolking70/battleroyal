# Phase 4A-4.3.2 Audit Fixes

## v2 closure

The real v2 candidate `752052e828e7708ebc010457bb9eca11e718a7ec91e18e63dd8b133ad11f6159` was confirmed from metadata, `art:list` and the Phase 4A-4.3.1 report, then formally rejected with the human reason that the duplicated binocular prop persisted. v1 `80109ee0510cc4132aa26518dfa1d37d59b0ebb4df5daddc57e1a88bb6fed7c1` remains preserved and rejected. No other historical candidate was modified.

## Strategy correction

The single-prop state-transition strategy is now frozen as failed after two human-rejected attempts. The Scout Combat task moved from revision 3 to 4 and now uses:

- `postureOnly = true`
- `signaturePropMode = static`
- `handsEmpty = true`
- provider strategy: `descriptor-locked-text-only-dynamic-equipment-neutral-posture-only`

The prompt retains binoculars as Scout's signature identity, but fixes them at the center of the chest in their normal hanging position. Both hands are explicitly away from the binoculars and empty. All action language comes from torso lean, shoulder tension, head turn, gaze, open palm and clothing motion.

The provider prompt contains no prop-transition language, negative enumeration, injury state, internal task/entity ID, fixed weapon or military/tactical token. `negativePrompt` remains empty.

## Canary isolation

The canary requires exactly two prior rejected candidates (v1 and v2), revision 4, static signature prop and posture-only metadata. It makes one request with no retry or force path, then stops. Fighter/Engineer/Medic Combat, all other art tasks and Rain remain excluded. The new candidate remains pending and is not eligible for publication without explicit human approval.

## Result

The posture-only image passed technical validation and visually achieved the intended experiment: one static binocular pair, both hands empty and separated, recognizable Scout identity, and clear active threat-response posture. This is still a human-review result, not an automatic approval.
