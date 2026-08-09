# Phase 4B-0 Mobile UX Specification

The current CSS has a 1080px two-column breakpoint and a 760px single-column
breakpoint. It keeps `.game` overflow hidden and caps left/right columns at
340px on narrow screens. The 390×844 runtime capture confirms content is
clipped while the body has no horizontal overflow. This is a reachability risk,
not a Core/gameplay bug.

## Portrait phone (approximately 320–480px)

- Make the top strip a compact survival card: HP, Stamina, Zone status and
  countdown first; seed/attack-defense can move to a secondary disclosure.
- Put the current Zone scene first, with a horizontally scrollable or drawer
  map rather than six stacked cards.
- Keep a fixed bottom action rail for the next legal exploration/encounter
  actions; avoid controls being hidden below a clipped stage.
- Open Inventory, Craft and Log in a bottom sheet/drawer. The sheet must have a
  visible close/back control and preserve the action rail when appropriate.
- Encounter should stack Player → encounter state/actions → Enemy, with the
  combat log collapsed to a short recent view.

## Landscape phone

- Use a two-column shell only when measured height can show the action rail and
  encounter controls; otherwise use the same stacked scene/action flow as
  portrait.
- Keep the Zone navigator as a compact overlay or side drawer, not a fixed
  232px column.

## Tablet

- Use a scene-led center with a persistent compact Zone navigator and a
  collapsible planning rail. Allow the encounter player/enemy split at a wider
  breakpoint.

## Desktop (1024px and wider)

- Implement the Hybrid shell: scene-dominant center, compact Zone navigation,
  right planning rail, fixed action rail.
- Preserve a 1024px acceptance viewport with no critical clipping or hidden
  action.

## Motion and touch

No sound or new motion asset is planned. Use short CSS state transitions only;
add `prefers-reduced-motion` handling in the polish phase. Touch targets should
be at least 44 CSS px in the production mobile pass, with clear visible labels.
