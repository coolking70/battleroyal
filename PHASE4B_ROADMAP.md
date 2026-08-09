# Phase 4B Roadmap

The roadmap is ordered by player experience value, not by React component
ownership. Each phase is independently reviewable and keeps Core rules and
formal art provenance frozen unless a later prompt explicitly expands scope.

## Phase 4B-1 — Main Gameplay Visual Shell & Zone Visual Hierarchy

- **Goal:** Establish the Hybrid shell: Zone Background as the main scene,
  compact map/navigation layer, and P0/P1 hierarchy.
- **Scope:** Desktop gameplay shell, current Zone scene, Safe/Warning/Restricted
  state layers, action rail grouping, persistent survival/status treatment.
- **Out of Scope:** Combat redesign, Inventory/Craft redesign, mobile closure,
  new images, Core changes, new event rules.
- **Files likely affected:** `src/ui/screens/GameScreen.tsx`,
  `src/ui/components/ZoneMap.tsx`, `src/ui/components/StatusBar.tsx`,
  `src/ui/components/ActionBar.tsx`, `src/ui/styles.css`, UI tests.
- **Risks:** Scene contrast, information density, accidental hidden-state
  disclosure, desktop regression.
- **Tests:** UI render/smoke tests, Zone state matrix, asset path/fallback
  tests, 1024px/1280px screenshots, Phase 4A gates.
- **Human acceptance:** First glance identifies current Zone, HP/Stamina,
  danger and next legal action.
- **Exit criteria:** Main scene is not a thumbnail; Zone states are legible
  without color alone; no gameplay/core/art-byte changes; 1024px desktop pass.

## Phase 4B-2 — Encounter & Combat Feedback

- **Goal:** Make encounter mode unmistakable and organize Player / encounter
  state / Enemy information.
- **Scope:** Encounter layout, perceptible Player/Enemy visual states, action
  grouping, outcome feedback and combat-log focus.
- **Out of Scope:** Combat formulas, hidden NPC data, new Combat art, mobile
  closure.
- **Files likely affected:** `EncounterPanel.tsx`, `StatusBar.tsx`, styles,
  UI tests and screenshot fixtures.
- **Risks:** Revealing hidden enemy information; making accuracy/cost less
  visible while styling.
- **Tests:** Existing combat UI/core consistency tests plus encounter screenshots.
- **Human acceptance:** Player instantly knows who is involved, HP, weapon,
  style, Guard/EXPOSED, skill and available response.
- **Exit criteria:** Player/enemy sides are visually balanced and legal facts
  remain unchanged.

## Phase 4B-3 — Search / Loot / Inventory / Craft UX

- **Goal:** Make the search-result-to-item-to-equipment/craft loop readable.
- **Scope:** Search feedback levels, item cards/icons, equipment slots,
  inventory categories, craft goal/material states.
- **Out of Scope:** Loot tables, recipes, item balance, new item images.
- **Files likely affected:** `ActionBar.tsx`, `PendingPickupPanel.tsx`,
  `Inventory.tsx`, `CraftPanel.tsx`, `EventLog.tsx`, styles/tests.
- **Risks:** Persistent panels becoming too dense; changing action legality.
- **Tests:** Search/loot/equipment/craft UI tests and existing core invariants.
- **Human acceptance:** A found item and its use/equip/craft consequence are
  understood without reading the long log.
- **Exit criteria:** Consistent item identity across four contexts and no hidden
  material information.

## Phase 4B-4 — World Events & Restricted Zone Presentation

- **Goal:** Make persistent/instant events and Zone danger states hard to miss
  without modal fatigue.
- **Scope:** Event severity treatments, instant announcement path, warning and
  restricted overlays, duration/scope badges.
- **Out of Scope:** Event selection, durations, modifiers, extra AI variants by
  default.
- **Files likely affected:** `GameScreen.tsx`, `StatusBar.tsx`, `ZoneMap.tsx`,
  event presentation helpers, styles/tests.
- **Risks:** Too many banners, color-only communication, event scope confusion.
- **Tests:** World-event UI fixture states, Zone status matrix, accessibility
  contrast checks and Phase 4A audit.
- **Human acceptance:** Event scope/duration and Zone urgency are understood
  without opening the Log.
- **Exit criteria:** Persistent events use a restrained banner/badge; instant
  events get a short visible announcement; no rule changes.

## Phase 4B-5 — Mobile & Responsive Closure

- **Goal:** Make portrait phone, landscape phone, tablet and desktop action
  paths reachable without clipping.
- **Scope:** Bottom-sheet/drawer planning surfaces, fixed action rail,
  encounter stacking, scene/map responsive behavior and touch targets.
- **Out of Scope:** New gameplay, new assets, unrelated polish.
- **Files likely affected:** all UI screens/components and styles; mobile tests.
- **Risks:** Scroll locking, action rail overlap, modal/drawer accessibility.
- **Tests:** Browser screenshots at 390×844, 844×390, tablet and 1024px;
  keyboard/touch interaction checks.
- **Human acceptance:** No required main action needs horizontal scrolling or
  unreachable clipped content.
- **Exit criteria:** Portrait and landscape flows reach search, move, tabs and
  encounter resolution.

## Phase 4B-6 — Polish / Accessibility / Final Visual QA

- **Goal:** Resolve debugger feel, focus/contrast/reduced-motion gaps and close
  the visual QA loop.
- **Scope:** Focus states, contrast, motion preferences, spacing/type polish,
  result closure, Debug separation, final asset visibility audit.
- **Out of Scope:** Core/gameplay changes and unapproved art production.
- **Files likely affected:** styles, accessibility helpers, result/debug UI,
  tests and reports.
- **Risks:** Cosmetic work hiding P0/P1 information.
- **Tests:** Full regression, browser matrix, keyboard/screen-reader-oriented
  checks, art validation/audit and CI.
- **Human acceptance:** Visual hierarchy feels intentional and readable in a
  complete run.
- **Exit criteria:** Accessibility notes closed or explicitly deferred with
  evidence; CI and Phase 4A integrity remain green.

## Frozen next target

# Phase 4B-1 unique implementation target: Main Gameplay Visual Shell & Zone Visual Hierarchy

This is one theme. Encounter, Inventory, Craft, Mobile and final polish remain
later phases and must not be bundled into the next implementation prompt.
