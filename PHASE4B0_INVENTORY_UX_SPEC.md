# Phase 4B-0 Inventory / Equipment / Craft UX Specification

## Inventory model

- Keep equipment, inventory, consumables and materials as distinct visual
  groups while preserving the current eight-slot capacity.
- Show item icon, name, quantity, category and one core property in the compact
  row. Use click/tap disclosure for full description rather than expanding all
  descriptions permanently.
- Make the active weapon/armor slots visually stronger and include the same
  item icon used by the inventory row.
- Keep Use/Equip/Drop legality and costs visible. Encounter use remains allowed
  exactly as the Core currently permits.

## Craft model

- Put the selected craft goal at the top with output icon/name, a compact
  material checklist (`held / required`) and a clear missing-material state.
- Group recipes by output category or goal route, not by an unbroken technical
  list. Keep existing public-material recommendations and Engineer benefits;
  do not reveal hidden loot or alter recipes.
- Use existing 12 Item Icons only; no new icon generation. In Phase 4B-3,
  verify the same item representation in recipe, inventory, equipment and
  ground/pickup contexts.

## Placement recommendation

Desktop: keep planning as a secondary right panel during 4B-1, then allow a
drawer/expanded panel in 4B-3. Mobile: use a bottom sheet/drawer for Inventory,
Craft and Log so the Zone scene and action rail remain reachable.

Status: current text and icon consumers are `CODE-VERIFIED` and
`RUNTIME-VERIFIED`; target grouping is `HUMAN-PLAYTEST-NEEDED`.
