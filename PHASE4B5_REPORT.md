# Phase 4B-5 Report — Mobile & Responsive Closure

## Outcome

Phase 4B-5 is implemented within UX-012 scope. Desktop keeps the existing
three-column shell; tablet and phone layouts remove the planning/history rail
from the main scroll flow and expose it through a touch-sized drawer. The
mobile action rail remains available while the drawer is open. Phone encounter
layouts prioritize the frozen Player / center / Enemy composition and keep all
six combat actions reachable with one measured scroll operation.

The small log fix was completed in the same phase: `CRAFT_GOAL_SET` is now in
the player-action whitelist in `EventLog.tsx`, so the player's own goal-setting
action is visible without exposing NPC planner events.

## Implementation

- Added `src/ui/components/PlanningDrawer.tsx` as the single responsive shell
  for Inventory / Craft / History. It is a static right rail at desktop widths
  and a backdrop-backed, closable drawer at tablet/phone widths.
- Reworked the responsive grid in `src/ui/styles.css`:
  - `1024×768` and `768×1024` use the scene-led two-column layout; planning
    no longer consumes a compressed 152px row.
  - `844×390` gets a dedicated low-height layout with a 105px exploration Hero,
    a 75px encounter scene layer and compact combat composition.
  - `390×844` keeps exploration navigation available, but removes the secondary
    left column from the active encounter scroll flow; the encounter Hero is
    127px and the encounter block is 534.375px.
- Kept touch targets at or above 44 CSS px for mobile combat/action controls,
  drawer trigger and drawer close.
- Added responsive unit coverage and a clean-production Playwright evidence
  spec for all five required viewports, planning open/close, encounter action
  reachability, pending-pickup completion and horizontal-overflow checks.

No gameplay rule, numeric value, event, loot, RNG or save behavior was changed.

## Runtime measurements

Baseline values below are the acceptance measurements supplied for HEAD
`d2b1022`. After values are from `npm run build` followed by the clean
`npm run preview` Playwright run. Evidence and runtime snapshots are in
`output/phase4b5-browser/` (the directory is ignored as in earlier phases).

| Viewport | Before | After | Result |
| --- | --- | --- | --- |
| `1280×720` desktop | Hero `718×264`; stage `990/581` | Hero `718×265`; board `603/603`; planning rail `288×583`; encounter action scroll `409` in stage | No horizontal overflow; desktop rail remains static |
| `1024×768` tablet landscape | Planning rail compressed to `152px` | board `614/614`; planning drawer open `1008×684`; Hero `792×265` | Planning removed from board flow; drawer contents visible |
| `768×1024` tablet portrait | board `869/830`; planning rail in desktop-style flow | board `830/830`; planning drawer open `752×940`; Hero `536×265` | No compressed planning row |
| `844×390` phone landscape | board `236px`; Hero `264px`; stage `190/507` | exploration Hero `830×105`; active encounter Hero `830×75`, encounter `810×319.89`; action scroll `246` | Hero fits low-height shell; six actions visible after measured scroll |
| `390×844` phone portrait | board `481/2173`; Hero `360×221`; encounter `581px`; action scroll about `540` | exploration board `503/845`; active board `464/933`; Hero `368×127`; encounter `336×534.375`; action scroll `393` | Secondary left column no longer adds encounter scroll debt |

All five runtime snapshots reported
`document.documentElement.scrollWidth === window.innerWidth` and
`document.body.scrollWidth === window.innerWidth`. The browser assertion
counted all six encounter buttons inside the viewport after the recorded
scroll operation. The portrait pending-pickup run reached the decision surface
at board scroll `719`, then completed the `放弃该物品` decision successfully.
The open portrait planning drawer ended at `y=712`, immediately above the
`y=715.14` action bar, so it does not cover the search/rest controls.

## Evidence grading

`CODE-VERIFIED`:

- Planning content is rendered once; the responsive shell changes placement,
  not information semantics.
- Drawer open/close state, six zone entries, action rail, and the
  `CRAFT_GOAL_SET` visibility boundary are covered by Vitest tests.
- CSS breakpoints cover desktop, tablet portrait/landscape, phone
  portrait/landscape, and preserve the frozen zone/combat content.

`RUNTIME-VERIFIED`:

- `tests/browser/phase4b5-responsive-evidence.spec.ts` passed against the
  clean production preview for all five viewports.
- Exploration controls, six movement entries, planning drawer, six combat
  actions and pending-pickup completion were exercised.
- Browser console errors: `0`; page errors: `0`.

`HUMAN-PLAYTEST-NEEDED`:

- Real-device touch feel, safe-area behavior on devices with a home indicator,
  and whether the drawer height feels comfortable during extended play still
  need a human pass. Automated viewport evidence does not claim those facts.

## Information-boundary checklist

- [x] No NPC location, intent, planner reason or hidden inventory was added.
- [x] The existing default EventLog visibility filter remains in force after
      the responsive reparenting.
- [x] `CRAFT_GOAL_SET` exposes only the player's own action.
- [x] No future event, future restricted zone or undiscovered loot is rendered.
- [x] Planning drawer is a layout surface; it does not add hidden state or
      alter the debug/full-state path.

## Gate results

| Gate | Result |
| --- | --- |
| `npm ci` | PASS — clean dependency installation |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 63 files / 1261 tests |
| `npm run build` | PASS |
| `npm run audit:save` | PASS — 74/74 malformed fixtures rejected |
| `npm run audit:deps` | PASS — 0 violations |
| `npm run art:doctor -- --offline` | PASS |
| `npm run art:validate` | PASS |
| `npm run art:audit:phase4a` | PASS — provenance/runtime/candidate hygiene |
| `npm run art:security:browser` | PASS |
| `npm run art:security:repo` | PASS |
| `npm run simulate -- --games 500 --seed-prefix PHASE4B5 --regression --output reports/phase4b5-balance.json` | PASS — 500/500 regression; balance ratio remains an observation-only warning |
| `npm audit --omit=dev` | PASS — 0 production vulnerabilities |
| clean production browser evidence | PASS — 5 viewports, 0 console/page errors |

## Scope and integrity

- Image-generation API calls: **0**.
- Formal `public/assets/**/*.png` files modified: **0**; all 35 remain
  byte-identical.
- `art/approved-assets.json` / Candidate status modified: **0**.
- `src/core/**` / `src/data/**` modified: **0**.
- Package version and `GAME_VERSION`: unchanged at `0.3.2`.
- Gameplay rules, event timing, values, loot, RNG and Save schema: **0
  changes**.
- Phase 4B-1 through 4B-4 visual semantics remain frozen; no 4B-6 polish,
  focus, contrast, reduced-motion or Result work was pulled forward.
- Existing user-owned `reports/save-validation-audit.json` and
  `reports/save-validation-audit.md` remain unstaged and are not part of the
  Phase 4B-5 change set.
