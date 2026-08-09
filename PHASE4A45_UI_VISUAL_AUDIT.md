# Phase 4A-4.5 UI Visual Audit

## Current consumers

| Component | Getter / resolver | Variant condition | Fallback |
| --- | --- | --- | --- |
| `MenuScreen` | `getCharacterVisual` | Character selection uses Portrait | `VisualImage`: official → local SVG → emoji |
| `StatusBar` | `resolveCharacterVisualState` + `getCharacterVisual` | HP threshold first, then active encounter | Same three-stage fallback |
| `EncounterPanel` | Shared resolver + `getCharacterVisual` | Visible opponent uses Combat while encounter is active; Injured wins at low HP | Same three-stage fallback |
| `ZoneMap` / `GameScreen` | `getZoneVisual` | Zone map/current stage background | Same three-stage fallback |
| `Inventory` | `getItemVisual` | Visible inventory item row | Category emoji fallback |
| `GameScreen` event banner | `getWorldEventVisual` | Active relevant event only | Event SVG/emoji; Rain fallback remains active |

The Combat image is now consumed by the real StatusBar and EncounterPanel paths. NPC state is not revealed remotely: the opponent image is resolved only inside the already-visible active EncounterPanel. No image is added to unrelated panels merely to inflate coverage.

## Fallback audit

`VisualImage` removes the failed `<img>` and advances one-way to local SVG and then emoji/color. Unknown character, zone, item and event IDs return safe fallback specs. Formal-image error behavior is covered by the existing component tests and the Phase 4A-4.5 coverage tests. Zone warning/restricted remain CSS/status presentation concerns and do not trigger new asset production.

Detailed machine-readable usage evidence: [runtime usage JSON](reports/phase4a45-runtime-usage.json).
