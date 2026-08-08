# Phase 4A-2.1 Character Strategy

## Experiment design

The previous character strategy was negative-heavy: the provider-facing text repeatedly named firearm, rifle, weapon, military, tactical, and related concepts in `AVOID` and hard-constraint sections. Because Agnes does not expose a native negative-prompt field, those words were still part of the single provider prompt.

The new strategy is `character-positive-only`. For exactly Engineer, Fighter, and Medic portrait tasks it:

- uses the v2 render style and positive character presentation style;
- supplies only a provider-facing occupational identity and positive appearance traits;
- does not read the design-sheet `Avoid` section;
- does not inject global negative prompts, category avoid lists, or weapon-negative hard constraints;
- uses positive composition requirements for waist-up framing, a pale neutral backdrop, unobstructed shoulders, and a clean back silhouette;
- sends an empty negativePrompt, so Agnes receives no synthetic `Avoid:` suffix.

The experiment variable is whether removing weapon/military/survival vocabulary from the entire final Provider Prompt prevents the recurring long-gun contamination.

## Payload audit

`tools/art/promptAudit.ts` scans the actual Agnes request payload, not only the intermediate prompt object. The audit checks the forbidden vocabulary list, internal task ID, internal entity ID, and design-sheet heading. Engineer, Fighter, and Medic each recorded zero forbidden tokens.

## Result

All three new candidates passed technical validation and showed no obvious gun, long-gun, tactical chest-rig, or military-uniform contamination in the hard visual check. This is a positive technical experiment result, not a human art approval. All three remain pending in the character review package.
