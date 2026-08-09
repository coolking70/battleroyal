# Phase 4B-6 Report — Polish / Accessibility / Final Visual QA

## Outcome

Phase 4B-6 is complete within the frozen Phase 4B scope. The pass adds the
final accessibility and visual-QA layer without changing gameplay rules,
information semantics, responsive composition, or formal art assets.

- Global `:focus-visible` treatment now gives keyboard users a stable,
  high-contrast focus ring.
- Action, combat, drawer and fallback surfaces expose costs and disabled
  context through accessible names or visible supporting copy; no source
  `title=` hover-only explanation remains.
- The PlanningDrawer now has one planning/history surface: the redundant
  `日志` tab was removed because the history panel is already persistent.
  Opening focuses `关闭`, Escape closes the drawer, and focus returns to the
  trigger.
- ResultScreen now uses the existing official Zone and player-character
  visuals through `VisualImage`, with a scrim and outcome treatment. No new
  image was generated.
- DebugPanel remains opt-in at `?debug=1`, is explicitly marked `DEV ONLY`,
  and is positioned above the fixed action bar rather than over it.
- `prefers-reduced-motion: reduce` collapses CSS animation/transition timing
  and disables smooth scrolling.

## Runtime measurements

Evidence was taken after `npm run build` from the clean production preview.
The evidence directory is `output/phase4b6-browser/`; the skill smoke output is
in `output/phase4b6-skill-client/`.

| Viewport | Final Hero | Encounter block | Minimal scroll to show all 6 actions | Horizontal overflow |
| --- | ---: | ---: | ---: | --- |
| 1280×720 | 718×265 | 686×493.2 | 106 (stage) | none |
| 1024×768 | 792×264 | 760×482.4 | 85 (stage) | none |
| 768×1024 | 536×264 | 504×496.4 | 0 | none |
| 844×390 | 830×75 | 810×319.9 | 127 (board) | none |
| 390×844 | 368×127 | 336×534.4 | 81 (board) | none |

Every snapshot reports `document.documentElement.scrollWidth === innerWidth`
and `document.body.scrollWidth === innerWidth`. The portrait planning sheet
measured `x=8, y=8, width=374, height=704`; the action bar begins at `y=715.14`,
so the sheet does not cover the primary action rail. The mobile DebugPanel
measured `bottom=706` while the action bar begins at `715.14`; intersection was
`false`.

Reduced-motion runtime values for an action button were `0.12s` under normal
motion and `1e-05s` under reduced motion (the browser’s computed form of
`0.01ms`).

## Test and gate results

| Gate | Result |
| --- | --- |
| `npm ci` | PASS — clean lockfile installation |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 64 files / 1266 tests |
| `npm run build` | PASS |
| `npm run audit:save` | PASS — 74 malformed saves rejected |
| `npm run audit:deps` | PASS — 0 violations |
| `npm run art:doctor -- --offline` | PASS |
| `npm run art:validate` | PASS |
| `npm run art:audit:phase4a` | PASS — manifest/provenance/hygiene/runtime |
| `npm run art:security:browser` | PASS |
| `npm run art:security:repo` | PASS |
| `npm run simulate -- --games 500 --seed-prefix PHASE4B6 --regression --output reports/phase4b6-balance.json` | PASS — 500/500, engine healthy, character ratio 2.0 < 2.5 |
| `npm audit --omit=dev` | PASS — 0 production vulnerabilities |
| clean production browser evidence | PASS — 5 viewports, 3 states, 0 console/page errors |

## Accessibility and information-boundary checks

- [x] Global `:focus-visible` ring and non-focus-visible outline reset.
- [x] Drawer open/close focus order and Escape behavior are unit- and
      runtime-verified.
- [x] Action and combat costs remain visible in button content and accessible
      names; disabled reasons are not title-only.
- [x] Existing icon/text/pattern state cues remain intact; this phase does not
      replace non-color semantics with color-only styling.
- [x] Reduced-motion CSS is present and runtime-verified.
- [x] Result surface uses only the player, current Zone and already-public
      outcome; it adds no hidden NPC or future-state data.
- [x] Default EventLog still filters NPC position, pickup, resource
      percentage and planner-reason events. The Phase 4B-6 regression test
      confirms the 4B-4 boundary remains intact.
- [x] Debug-only full state remains behind `?debug=1`; the normal gameplay
      hierarchy does not mount DebugPanel.

## Evidence grading

`CODE-VERIFIED`: CSS focus/reduced-motion rules, zero source `title=` attrs,
single planning/history surface, ResultScreen `VisualImage` usage, DebugPanel
opt-in placement, and information-boundary tests.

`RUNTIME-VERIFIED`: clean production preview screenshots and snapshots for all
five viewports, exploration/encounter/planning states, keyboard drawer focus,
Debug/action-bar isolation, reduced-motion computed timing, and zero browser
errors. The web-game skill client also rendered the real production menu with
`render_game_to_text() = {"mode":"menu"}` and zero console errors.

`HUMAN-PLAYTEST-NEEDED`: real-device touch feel, safe-area/home-indicator
behavior, screen-reader phrasing, and whether the final panel density and
reduced-motion timing feel comfortable over a long session.

## Scope and integrity declaration

- Image-generation API calls: **0**.
- Formal `public/assets/**/*.png` changes: **0**; all 35 remain byte-identical.
- `art/approved-assets.json` and Candidate statuses changed: **0**.
- `src/core/**` and `src/data/**` changed: **0**.
- Package version and `GAME_VERSION`: unchanged at `0.3.2`.
- Gameplay rules, values, events, loot, RNG and Save schema changed: **0**.
- Phase 4B-1 through 4B-5 layout and information semantics remain frozen.
- The existing user-owned `reports/save-validation-audit.json` and `.md` files
  remain unstaged and are not part of this phase commit.
