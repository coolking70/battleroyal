# Phase 4A-4.4 Combat Production Specification

## Shared contract

All three tasks use `character-combat-positive-only` with revision 4 and the strategy `descriptor-locked-text-only-dynamic-equipment-neutral-posture-only`. The final provider prompt is positive-only with an empty negative prompt. Combat state is communicated by posture, balance, facial tension and readiness. No dynamic game equipment is introduced.

## Fighter

The fixed signature is one matched pair of worn training gloves: one glove on each hand. The permitted visual state is a compact defensive boxing guard. Gloves are wearable role costume, not dynamic game equipment. The candidate must preserve the charcoal-gray jacket, rust-orange trim, wraps and athletic identity.

## Engineer

The fixed signature is one compact adjustable wrench secured in its normal carried position on the waist tool belt. Both hands remain empty and away from tools. The wrench may not be held, raised, swung, used for repair or reached for. Reactive state is posture and balance only, with ochre workwear and tool-belt identity preserved.

## Medic

The fixed signature is a closed white-and-green first-aid waist pouch fixed in its normal position. Both hands remain empty and away from the pouch. The pouch may not be opened or interacted with; healing, treatment and bandage action language is forbidden. Reactive state is cautious posture and facial tension only, with green/off-white workwear and bob hairstyle preserved.

## Review gate

Automatic validation confirms image bytes, dimensions, ratio, prompt contracts and provider metadata. Human review must still compare each candidate with the official Portrait and Injured assets, verify the signature prop and reject any action-state or identity failure. Pending candidates are not runtime assets until a separate explicit approval and publish operation.
