# Phase 4A-4.3.1 Single-Prop Strategy

## Root cause

The old semantics combined a signature prop existing on the neck/chest with a signature prop being held near the face. A text-to-image model can interpret those as Object A + Object B rather than one object moving between states.

## Correct semantic model

This phase treats the binoculars as one immutable signature prop undergoing an Object State Transition:

`neck-attached state → raised-in-hand state`

The prompt must establish a single pair, explicitly identify that same pair, keep one neck strap connected to it, and make the chest beneath the raised prop visually clear. It must not present a separate chest-mounted and hand-held state in parallel.

## Preserved policy

The provider-facing strategy remains:

`descriptor-locked text-only dynamic-equipment-neutral positive-only`

The Scout remains an alert civilian urban observer with the established age, short dark hair, slate-blue jacket, charcoal shirt, khaki trousers and side pouch. One hand raises the signature binoculars and the free hand remains open. Combat state art still does not define weapons or military/tactical equipment; those belong to item/equipment systems.

The single-prop rule is local to a character signature prop whose position changes in an action variant. It is not generalized to other character Combat tasks in this phase.

## Stop rule

This was a single-variable experiment with one API call. Because the result still duplicates the prop, no Scout Combat v3/v4 and no remaining Combat batch are authorized. The next strategy, if the user requests recovery, is posture-only Combat with the binoculars kept at rest and neither hand operating them.
