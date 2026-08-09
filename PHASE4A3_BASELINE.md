# Phase 4A-3 Baseline

Captured before Phase 4A-3 B2 formalization and B3 provider requests.

- Branch: `agent/phase4-art-pipeline`
- HEAD: `3670dbd1280990a309a8342c9d06f75032c0ce25`
- Baseline tests: 810 passing
- Formal AI assets: 9
- B2 human approval: Residential, Factory, Forest, Lab, Water and Energy Drink; formal approval pending
- Rain: provider compatibility blocked; no Phase 4A-3 request permitted
- Pre-existing unrelated worktree changes preserved unstaged: `reports/save-validation-audit.json`, `reports/save-validation-audit.md`

## Current item ArtTasks

The repository contains 12 item ArtTasks:

`wood`, `iron`, `bandage`, `medkit`, `energy_drink`, `stone_axe`, `iron_pipe`, `simple_bow`, `simple_armor`, `plate_armor`, `water`, `battery`.

## Existing formal items

- Bandage
- Medkit

Water and Energy Drink have approved B2 candidates but are not yet formalized at this baseline. The eight remaining planned Item ArtTasks are the real B3 inventory, in the required production order: Battery, Iron, Wood, Iron Pipe, Stone Axe, Simple Bow, Simple Armor, Plate Armor.

## B3 category mapping from `src/data/items.ts`

- Materials: Battery, Iron, Wood
- Weapons: Iron Pipe, Stone Axe, Simple Bow
- Armor: Simple Armor, Plate Armor

No new item task or gameplay item definition will be created. No `src/core/**` or `src/data/**` file is in scope for this phase.
