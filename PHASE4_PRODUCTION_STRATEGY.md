# Phase 4 Production Strategy

The stable production policy is now frozen:

- Character → `character-positive-only`
- Zone → `environment-positive-only`
- Item → category-aware `item-positive-only`
- World Event → per-event special handling

## Item categories

- Consumable: single isolated consumable object.
- Material: single crafting-material subject.
- Weapon: weapon alone as an isolated object; weapon identity is allowed, but no character or battle scene.
- Armor: protective equipment alone; no wearer or mannequin composition.

All item categories share Render Style, Item Presentation, positive entity brief, positive composition and technical requirements. Negative prompts remain empty for positive-only item production. Provider payload audits reject person/wearer, scene/environment and UI semantics without banning the target category itself.

## Event exception

Rain remains **provider compatibility blocked**. It receives no retry in Phase 4A-3 and is not an art-quality failure. Event production remains a separate future phase.
