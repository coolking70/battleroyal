# Phase 4 Production Strategy

The stable production policy is now frozen:

- Character → `character-positive-only` — Character Base Portrait Production Proven
- Character Injured Base Variants → `descriptor-locked text-only` positive-only — 4/4 official; production complete
- Character Combat State → `descriptor-locked text-only dynamic-equipment-neutral` — state art only; Scout canary requires human review
- Zone → `environment-positive-only` — Zone Background Production Complete
- Item → category-aware `item-positive-only` — Item Base Icons Production Complete
- World Event Base Illustrations → 5/6 official; E1 uses controlled per-event `event-positive-only` production

## Item categories

- Consumable: single isolated consumable object.
- Material: single crafting-material subject.
- Weapon: weapon alone as an isolated object; weapon identity is allowed, but no character or battle scene.
- Armor: protective equipment alone; no wearer or mannequin composition.

All item categories share Render Style, Item Presentation, positive entity brief, positive composition and technical requirements. Negative prompts remain empty for positive-only item production. Provider payload audits reject person/wearer, scene/environment and UI semantics without banning the target category itself.

## Injured character variants

Injured portraits use a descriptor-locked text-only strategy. The provider receives a complete positive visual identity descriptor derived from the approved base portrait and Character Design Sheet, plus only mild state changes: slight fatigue, light dust or scuffing, a small dressing and a restrained expression change. The `negativePrompt` remains empty for character-positive-only tasks. This is not reference guided, img2img or image conditioned generation: approved portrait bytes are not sent to Agnes. New candidates remain pending until human review; no similarity score, automatic approval/rejection or reroll is permitted. Approved assets are published only through explicit review and publish commands.

## Combat state variants

Combat state art is a state illustration, not an equipment illustration. It communicates expression, posture, tension and motion while remaining equipment-neutral; weapon visuals belong to item/equipment systems and are never fixed into a character Combat portrait. The provider receives only a positive descriptor-locked text-to-image prompt. No reference image is passed, and no reference-guided or image-conditioned capability is claimed. Scout Combat is a one-sample canary; it remains pending and unpublished until human review.

## World event policy

World events are handled per event with a provider-facing positive brief and task-specific prompt audit. Blackout, Emergency Broadcast, Medical Alert, Research Anomaly and Citywide Unrest are official. Rain remains the sole **Provider Compatibility Exception** after two provider rejections: official image is none, runtime fallback is active, and it receives zero calls in this phase.
