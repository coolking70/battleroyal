# Phase 4A-4.3.1 Audit Fixes

## Previous candidate closure

The previous Scout Combat candidate was read from the real Phase 4A-4.3 report, candidate metadata and `art:list`:

`80109ee0510cc4132aa26518dfa1d37d59b0ebb4df5daddc57e1a88bb6fed7c1`

It was pending at baseline and was formally rejected with the exact human reason: duplicated binocular prop; one pair was raised near the face while another remained on the chest. No other historical candidate was changed.

## Minimal semantic fix

The only task revision was `character/scout/combat`, revision 2 → 3. Character identity, clothing, posture, civilian observer framing and equipment-neutral policy were preserved. The ambiguous description of binoculars hanging while another hand held them was removed.

The new provider prompt uses a positive Object State Transition:

`a single pair` → `that same pair` → `one simple neck strap` → `raised near his face` → `center of his chest ... clear`

No negative enumeration was added. The provider-facing prompt remains positive-only with an empty `negativePrompt`. No internal task/entity ID, reference claim, injured-state token or fixed weapon/military token is present.

## Execution boundary

- New prompt hash: `752052e828e7708ebc010457bb9eca11e718a7ec91e18e63dd8b133ad11f6159`
- Previous prompt hash: `80109ee0510cc4132aa26518dfa1d37d59b0ebb4df5daddc57e1a88bb6fed7c1`
- Hash changed; no `--force` was used.
- Exactly one Scout Combat API call, zero cache hits, zero retries and zero rerolls.
- Fighter/Engineer/Medic Combat calls: 0.
- Injured, Portrait, Zone, Item, World Event and Rain calls: 0.
- New candidate remains pending; no approval or publication occurred.

## Honest visual result

Automatic validation passed at 864×1152 PNG. Human visual inspection found that the single-prop objective still failed: one pair is raised near the face while a second complete pair remains on the chest. This is recorded as an art-strategy failure only. The pipeline correctly stopped without an automatic decision.

## Regression protection

The tests now require the single-instance/same-instance transition anchors, reject the old independent hanging-plus-raised semantics, verify the real Agnes payload, audit dynamic equipment/injured/internal-ID constraints, verify prompt hash change, and exercise the rejected-old-candidate flow.
