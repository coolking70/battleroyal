# Phase 4M Human Playtest Handoff

Status: `NEEDS-HUMAN-PLAYTEST`

Automated A–N tests, UI tests, production build and deterministic 500-game
engine regression are complete. Human review is still required for feel,
readability and conservation cues in the expanded crafting loop.

## Checklist

- [ ] Set `war_axe` as the target and verify the Guide/Codex displays
  `金属板 ×2` across the two dependency branches.
- [ ] Craft and consume the first `metal_plate` through `sharpened_metal`;
  verify the route asks for the remaining plate again rather than treating the
  historical `ITEM_CRAFTED` event as completion.
- [ ] Start with all raw leaves for a deep route and verify the UI says
  “原料齐全” plus the next intermediate, not “可直接合成” for the final item.
- [ ] Start a new game as Engineer and verify the Craft panel shows raw →
  component → final steps, including a current target and a missing-source
  zone suggestion.
- [ ] Craft one intermediate, then return to the panel and confirm the next
  craft advances without asking for the already-owned component again.
- [ ] Fill the inventory, attempt a craft, and verify no ingredient, stamina,
  output or free-craft charge disappears on failure.
- [ ] Craft a new weapon, armor and `field_kit`; equip each through the normal
  inventory controls and confirm the single utility slot is visible.
- [ ] Damage a crafted weapon through combat, save, reload and confirm its
  bounded durability is retained.
- [ ] On a narrow/mobile viewport, open the Craft panel and Inventory panel;
  confirm the `metal_plate ×2` dependency text, source-zone hint and utility
  slot remain reachable without horizontal clipping.

## Notes

No new art generation or procedural item variation is part of Phase 4M. New
items use the existing visual fallback path until a later explicitly scoped art
phase.
