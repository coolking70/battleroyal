# Phase 4B-0 Visual Hierarchy Specification

## Priority model

| Priority | Information | Required treatment in the future shell |
| --- | --- | --- |
| P0 Immediate survival | HP, Stamina, current danger, active Encounter, Zone warning/restricted, death risk | Persistent, high-contrast, short labels and state icon/pattern; never hidden behind a tab |
| P1 Current action | Current Zone, legal actions, cost, Search result, combat choices, skill readiness | Main scene-adjacent action rail/card; disabled reasons visible without hover-only dependence |
| P2 Planning | Equipment, inventory, craft route, public intel, noise, event duration | Secondary panel/drawer; visually structured but subordinate to P0/P1 |
| P3 History / secondary | Long log, statistics, Debug, detailed event history | Collapsible/tabbed/drawer surfaces; must not compete with the survival shell |

## Current hierarchy audit

`StatusBar` contains P0 values but presents them as a single mono line. `ZoneMap`
and `ActionBar` split P1 across the left edge and bottom edge. The central stage
contains a mixture of P0 (Encounter, pending pickup) and P2 (description, ground
loot), while the right column hides P2/P3 tabs. The result is functionally
complete but visually flat: borders and text weight do most of the hierarchy
work.

## Target ordering

1. **Survival strip:** HP/Stamina, current Zone status, countdown/danger, and
   active Encounter state.
2. **Scene:** current Zone Background as the largest contextual image, with a
   readable Zone name/status overlay.
3. **Action rail:** only legal high-value actions for the current mode; split
   exploration and encounter groups.
4. **Planning drawer:** equipment, inventory, craft and public intel.
5. **History/debug:** log and Debug remain available but visually quiet.

## Debugger-feel audit

The visual debt comes from repeated `.panel` boxes, mono labels, dense stat
rows, many buttons, and large empty central space. The repair should be spatial
and state-led: enlarge the scene, reduce simultaneous action surfaces, and use
state cards/overlays for changes. It should not be a full CSS rewrite in
Phase 4B-0 and must not alter gameplay rules.

## State treatment requirements

- Never communicate Safe/Warning/Restricted by color alone. Pair color with
  text, icon and a distinct pattern/edge treatment.
- A disabled button must expose its reason through visible supporting text or a
  stable accessible label, not only a browser tooltip.
- Encounter and full-inventory states must take visual focus away from ordinary
  exploration.
- Character image size must be large enough for the Portrait/Combat/Injured
  distinction to be perceived; retaining all three states is worthwhile.
- The target shell must preserve the current legal-information boundary: no
  hidden NPC values become visible for visual clarity.
