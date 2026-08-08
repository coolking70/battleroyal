# Phase 4 Production Strategy

The stable production policy is now frozen:

- Character → `character-positive-only` — Character Base Portrait Production Proven
- Zone → `environment-positive-only` — Zone Background Production Complete
- Item → category-aware `item-positive-only` — Item Base Icons Production Complete
- World Event → controlled per-event production; E1 uses `event-positive-only`

## Item categories

- Consumable: single isolated consumable object.
- Material: single crafting-material subject.
- Weapon: weapon alone as an isolated object; weapon identity is allowed, but no character or battle scene.
- Armor: protective equipment alone; no wearer or mannequin composition.

All item categories share Render Style, Item Presentation, positive entity brief, positive composition and technical requirements. Negative prompts remain empty for positive-only item production. Provider payload audits reject person/wearer, scene/environment and UI semantics without banning the target category itself.

## World event policy

World events are handled per event with a provider-facing positive brief and task-specific prompt audit. Blackout is official. Emergency Broadcast, Medical Alert, Research Anomaly and Citywide Unrest are controlled E1 candidates pending human review. Rain remains a **provider compatibility exception** after two provider rejections: it receives zero calls in E1 and is not an art-quality failure.
