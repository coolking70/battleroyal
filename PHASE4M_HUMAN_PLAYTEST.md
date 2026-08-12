# Phase 4M Human Playtest Handoff

Status: `NEEDS-HUMAN-PLAYTEST`

Automated A–N tests, UI tests, production build and deterministic 500-game
engine regression are complete. Human review is still required for feel,
readability and conservation cues in the expanded crafting loop.

## Checklist

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
  confirm the dependency text, source-zone hint and utility slot remain
  reachable without horizontal clipping.

## Notes

No new art generation or procedural item variation is part of Phase 4M. New
items use the existing visual fallback path until a later explicitly scoped art
phase.
