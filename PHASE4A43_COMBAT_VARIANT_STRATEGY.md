# Phase 4A-4.3 Combat Variant Strategy

## Decision

`character/scout/combat` is a controlled state-art canary, not an equipment-art task. The provider-facing strategy is:

`descriptor-locked-text-only-dynamic-equipment-neutral`

The art should communicate a healthy, intact Scout in an alert, active, tense civilian observation posture. It may use forward lean, focused expression, raised shoulders, binocular observation and clothing motion. It must preserve the Scout identity descriptor and remain equipment-neutral regarding fixed weapons.

## Ownership boundary

Weapon visuals belong to item/equipment systems. A character Combat state does not define a weapon, firearm, ammunition, holster, plate carrier, chest rig, military kit or tactical loadout. This keeps character state art reusable across inventory and equipment configurations.

No reference image bytes are sent to the provider. No reference-guided or image-conditioned capability is claimed. The provider receives one positive-only text prompt with no internal task/entity ID and no negative prompt.

## Execution boundary

- Exactly one task: `character/scout/combat`.
- Exactly one API call, concurrency 1.
- No cache reuse, retry, reroll or automatic regeneration.
- No Fighter/Engineer/Medic Combat generation.
- No additional Injured, Rain, Zone, Item or World Event calls.
- Candidate remains pending and is absent from the formal Manifest until explicit human approval and publish.

## Review boundary

The human reviewer checks identity continuity, active-state readability, distinction from Portrait and Injured, binocular/side-pouch continuity, and absence of fixed weapon or military/tactical contamination. Objective observations are recorded for review and do not decide approval.
