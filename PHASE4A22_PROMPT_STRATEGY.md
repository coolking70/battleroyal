# Phase 4A-2.2 Prompt Strategy

## Character conclusion

The prior character prompt path repeatedly described forbidden equipment and contamination semantics. The positive-only path instead gives Agnes a civilian visual identity: boxing athlete, workshop repair technician, and community first-aid worker. All three approved candidates passed the provider-prompt audit and are now formal portraits.

`character-positive-only` is now a stable strategy for base portraits. Future variants should begin from an approved visual identity, but no injured or combat variants are generated in this phase.

## Environment recovery

Hospital and Rain move from negative-heavy environment prompts to `environment-positive-only`. The provider prompt contains location or weather anchors such as vacant waiting hall, empty chairs, deserted street, empty sidewalks, heavy rainstorm and puddles. It does not append generic negative text or zero-human instructions.

The exact Provider prompt audits for both tasks returned zero forbidden environment tokens. Hospital produced a valid pending candidate. Agnes rejected the single Rain request before an image response, so this phase stops without a reroll.

## Item marking recovery

Medkit moves to `item-positive-only-unmarked`. The provider prompt describes a compact portable emergency supply case with an off-white shell, green accent panels and blank front surfaces. It does not mention the protected marking vocabulary that previously appeared in the image. The exact Provider payload audit returned zero marking tokens and the generated candidate remains pending.

If a later Medkit candidate still contains a protected marking, stop text-to-image retries and evaluate local editing of the existing high-quality case, as required by the phase plan.
