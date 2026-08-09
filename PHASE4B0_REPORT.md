# Phase 4B-0 Report

## Verdict

**PHASE 4B-0 = PASS**

**Runtime Visual Presentation Plan = FROZEN**

**UX Architecture = FROZEN**

**READY FOR PHASE 4B-1**

This phase stopped at audit/planning as required. It did not begin Phase 4B-1
implementation.

## Final technical state

- Baseline and final audit HEAD for this phase: `521f8756a364b38ebd91b18b97d4a5dac3aea4fa`.
- Branch: `agent/phase4-art-pipeline`.
- Package and `GAME_VERSION`: `0.3.2`; no version bump.
- Baseline test count: 57 files / 1236 tests.
- Final regression test count: 57 files / 1236 tests (no tests deleted).
- Formal assets: 35; no `public/assets/**/*.png` was modified.
- Candidate statuses and gameplay/Core behavior: unchanged.
- Image API calls: 0. No Agnes, Rain retry, Zone variant, character variant,
  item variant or event generation occurred.
- `src/core/**` and `src/data/**`: unchanged.

## Evidence boundary

The real Vite app was exercised at 1280×720 and 390×844. The browser captured
menu, initial gameplay, search/item result, active encounter, Craft tab, Log
tab and mobile portrait. `render_game_to_text` matched the visible state and
reported `mode=playing`; the search advanced time and reduced Stamina, and the
deterministic run reached an active encounter at T6. No console or page errors
were recorded. The mobile capture confirms vertical clipping risk; no
horizontal overflow was observed (`scrollWidth=390`, `innerWidth=390`).

The following remain human-playtest judgments: whether the prototype tone is
acceptable, whether the proposed hierarchy feels immediately readable, and
whether the future overlay contrast works across every Zone image.

## Q1 — Three largest current UI problems

1. The Zone Background is technically loaded but displayed as a 30×30 stage
   thumbnail, so the six scenes do not establish the play space.
2. P0/P1 actions and states are spread across the StatusBar, ZoneMap, central
   stage, right tabs and ActionBar; Encounter is visually stronger but still
   lacks a player-side combat composition.
3. The responsive shell clips vertically on a portrait phone because the game
   container hides overflow while stacked columns have height caps.

## Q2 — Highest and lowest asset utilization

Highest: menu Portrait cards, the active enemy Combat thumbnail, and Item Icons
when a held item appears in Inventory. Lowest: all six Zone Backgrounds,
Injured variants, player-side Combat variants and the instant
`emergency_broadcast` illustration. Full per-asset entries are in
`reports/phase4b0-visual-visibility.json`.

## Q3 — Keep Portrait / Injured / Combat three states?

Yes. The three states map to distinct comprehension moments: baseline identity,
low-health danger and active engagement. The issue is not the state model; it
is that the current player/ Injured presentation is often only 18×18. Phase
4B-2 should make the existing three states perceptible without adding a fourth
variant.

## Q4 — Zone Background role

It should become the main gameplay scene for the current Zone, with readable
name/status overlays. The six-area navigation should remain a compact
semi-transparent planning layer. This is the selected Hybrid plan.

## Q5 — Need extra Zone Warning / Restricted AI images?

No, not for Phase 4B-0 or the default Phase 4B-1 plan. Existing Zone Background
plus CSS dark/amber overlays, icon, label and pattern conveys the states without
growing the art/provenance surface by 12 images. Reconsider only after human
testing shows the treatment fails over the existing art at phone size.

## Q6 — World Event presentation

Persistent events should use a restrained banner/badge with official icon,
scope and remaining duration. Instant events such as
`emergency_broadcast` should use a short visible announcement plus the existing
Log entry, not a blocking modal. Zone-specific events should attach their scope
to the current scene. Not every event should interrupt play with a large modal.

## Q7 — Encounter organization

Use three visual regions: Player, central encounter state/actions, Enemy. Show
only current legal facts: Player HP/Stamina/status; enemy identity/known HP
descriptor/weapon/status; shared hit/flee/cost information; combat log and
skill/Guard/Flee. Do not expose hidden equipment, precise unknown HP, hidden
skills, future actions or remote NPC information.

## Q8 — Largest mobile risk

Reachability, not horizontal overflow: the current portrait shell clips the
stacked map/stage/action content. The next mobile design needs a scroll-safe
scene, bottom action rail and bottom-sheet/drawer for planning/history.

## Q9 — Recommended Phase 4B order

1. Main Gameplay Visual Shell & Zone Visual Hierarchy.
2. Encounter & Combat Feedback.
3. Search / Loot / Inventory / Craft UX.
4. World Events & Restricted Zone Presentation.
5. Mobile & Responsive Closure.
6. Polish / Accessibility / Final Visual QA.

Each phase has Goal, Scope, Out of Scope, likely files, risks, tests, human
acceptance and exit criteria in `PHASE4B_ROADMAP.md`.

## Q10 — Unique next development target

# Phase 4B-1: Main Gameplay Visual Shell & Zone Visual Hierarchy

This is deliberately one theme. It does not include the encounter redesign,
Inventory/Craft redesign, mobile closure or full polish.

## Deliverables

- Planning specifications: baseline, surface inventory, gameplay flow, visual
  hierarchy, prototype debt, combat, search, inventory/craft, Zone presentation,
  mobile, feedback, accessibility and UI state matrix.
- Frozen roadmap and PR description proposal.
- Machine-readable UI surface, visual visibility and UX debt reports.
- Runtime evidence in the ignored `output/phase4b0-browser-runtime/` directory.
- Human playtest checklist with unresolved qualitative checks.

## Maintenance notes carried forward

- GitHub Actions currently use `actions/checkout@v4` and `actions/setup-node@v4`.
  Any Node runtime deprecation warning is a maintenance follow-up, not a scope
  expansion for this phase.
- `npm audit --omit=dev` remains the production security gate. Existing dev-only
  dependency vulnerabilities are recorded by the dependency audit; this phase
  does not run `npm audit fix --force`.
- `npm ci` still reports the known dev-tree advisory (5 vulnerabilities: 3
  moderate, 1 high, 1 critical). It is recorded, not force-fixed.
- Rain remains the documented runtime fallback under the Phase 4A provider
  exception.
