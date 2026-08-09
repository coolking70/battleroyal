# Phase 4B-3 Report — Search / Loot / Inventory / Craft UX

## Outcome

Phase 4B-3 was implemented within the frozen scope. Search now produces an in-place,
non-blocking result card for item, empty, and encounter outcomes; official item visuals
are used consistently in the five requested contexts; craft and equipment availability
reasons are visible; and the desktop right rail keeps planning and history visible
together. No core rules, data, formal art, or save behavior was changed.

The required CI blocker was fixed first in a separate commit:

- Commit: `8bc09bc ci: declare Playwright evidence dependency`
- GitHub Actions run: `31314784246` — `verify` PASS
- Pull request: `coolking70/battleroyal#2`

## Implementation

- Added `src/ui/itemPresentation.ts` for presentation-only item identity metadata,
  category labels, icons, summaries, and official visual paths.
- Added `src/ui/searchPresentation.ts` for deriving the latest player search feedback
  from existing structured events; it does not recalculate search or loot rules.
- Added `SearchResultFeedback.tsx` with item, empty-result, and encounter-compatible
  feedback rendering. Search feedback is not a modal and does not block actions.
- Added `VisualImage` rendering to inventory rows, equipment slots, craft outputs and
  ingredients, pending-pickup replacement choices, and ground drops.
- Added explicit craft states: available, missing materials, and other existing public
  blocking reasons. Missing material names and quantities are visible without hover.
- Reorganized the desktop right rail into a planning panel plus an always-visible
  history log panel. Mobile remains a scrollable stacked layout; the Phase 4B-5 drawer
  and bottom-sheet work is not included.

## Measurements

| Surface | Before | After / runtime evidence |
| --- | --- | --- |
| Search result | Toast/log only; no stage focus | Official result visual at 52×52; item and empty cards are in-place and non-blocking |
| Inventory row | 18×18 item visual | 18×18 retained, with unified category/name/summary metadata |
| Equipment slot | No item visual | 34×34 official visual; empty and candidate states remain explicit |
| Craft output / goal | No item visual | 32×32 output and 40×40 goal visual; ingredient visuals 24×24 |
| Pending pickup | Text-only | 48×48 pending item visual; replacement choices 24×24 |
| Ground drop | Text-only | 30×30 official visual |
| Desktop 1280×720 | Right tabs mutually exclusive | Body/document width 1280; planning rail 288px wide; history panel 288px wide; no horizontal overflow |
| Mobile 390×844 | Planning/history context was hidden by the tab model | Body/document width 390; board client height 519px; pending card max-height 420px; planning and history remain measurable and scrollable; action bar remains reachable |

Runtime snapshots are in `output/phase4b3-browser/`. The final clean production
preview run covered desktop item and empty results, craft available/blocked states,
equipped items, mobile pending pickup, and mobile planning/history coexistence.
The browser evidence recorded zero console errors and zero page errors.

## Verification and evidence grading

`CODE-VERIFIED`:

- `itemPresentation.ts` and `searchPresentation.ts` contain presentation metadata and
  event interpretation only; no loot, recipe, probability, capacity, or combat rule is
  duplicated.
- UI regression tests cover item/empty/encounter feedback, all five item-visual
  contexts, craft missing-state visibility, and information-boundary assertions.
- The full suite reached 60 test files / 1251 tests before the final gate rerun.

`RUNTIME-VERIFIED`:

- Clean `npm run build` followed by `npm run preview` was exercised by the Playwright
  evidence spec at 1280×720 and 390×844.
- `tests/browser/phase4b2-encounter-evidence.spec.ts` was also rerun on the clean
  production preview to confirm the frozen Phase 4B-2 encounter surface was not
  regressed.
- Runtime snapshots report `bodyScrollWidth === documentScrollWidth === 390` on the
  mobile cases and no console/page errors.

`HUMAN-PLAYTEST-NEEDED`:

- Subjective density, visual hierarchy preference, and the amount of scrolling in the
  stacked mobile secondary rail still require human usability review. This phase did
  not claim the Phase 4B-5 drawer/bottom-sheet finish.

## Information-boundary checklist

- [x] No zone-resident loot list is rendered.
- [x] No prediction of the next search result is rendered.
- [x] No undiscovered ground drop is rendered.
- [x] No other character inventory or equipment is rendered.
- [x] Enemy or hidden combat information is not added by this phase.
- [x] Craft recommendations remain limited to existing public goals/materials; no
      hidden zone state is inferred.

## Scope and asset integrity

- Image-generation API calls: **0**.
- New or modified formal PNG files: **0**; the existing 35 formal assets are untouched.
- `art/approved-assets.json` / Candidate status changes: **0**.
- `src/core/**` / `src/data/**` changes: **0**.
- Loot tables, recipes, item attributes, search probability, inventory capacity, RNG,
  save schema, package version, and `GAME_VERSION` changes: **0**.
- Package version remains `0.3.2`.
- Phase 4B-1 Zone Hero, route planning, StatusBar, and ActionBar semantics remain
  frozen; Phase 4B-4 through 4B-6 work was not pulled forward.

## Gate results

The final command results are recorded below after the clean-install verification:

| Gate | Result |
| --- | --- |
| `npm ci` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS |
| `npm run build` | PASS |
| `npm run audit:save` | PASS |
| `npm run audit:deps` | PASS |
| `npm run art:doctor -- --offline` | PASS |
| `npm run art:validate` | PASS |
| `npm run art:audit:phase4a` | PASS |
| `npm run art:security:browser` | PASS |
| `npm run art:security:repo` | PASS |
| `npm run simulate -- --games 500 --seed-prefix PHASE4B3 --regression` | PASS |
| `npm audit --omit=dev` | PASS — 0 production vulnerabilities |
