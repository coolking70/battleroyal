# Phase 4B-4 Report — World Events & Restricted Zone Presentation

## Outcome

Phase 4B-4 is implemented within the frozen World Events and Restricted Zone
presentation scope. Persistent events now have stable severity/urgency hierarchy,
scope and remaining-time labels. `emergency_broadcast` gets a short non-blocking
announcement while its existing historical event remains in the log. Warning and
restricted states add countdown, damage-per-turn, icon, text and pattern cues.

The required P0 log repair was completed first and independently:

- Commit: `e1745e4 fix: hide NPC details from default event log`
- CI run: `31317531844` — `verify` PASS
- P0 behavior: default EventLog filters NPC search/pickup/movement/planner output;
  player actions, player-participating combat, own environment damage and public
  broadcasts remain visible. DebugPanel still receives the full state.
- P0 regression: `tests/eventLogVisibility.test.tsx` and clean production screenshot
  evidence in `output/phase4b3-log-privacy/`.

## Implementation

- Added `src/ui/worldEventPresentation.ts` with presentation-only severity, icon,
  pattern, scope and remaining-time metadata. It does not calculate event rules or
  durations.
- Added `WorldEventFeedback.tsx` for persistent banners and the 4.5-second instant
  announcement. The announcement uses `role=status`, `aria-live`, existing
  `VisualImage` assets and no modal/blocking interaction.
- Extended `zonePresentation.ts` with warning countdown urgency and a player-only
  current-time hazard feedback selector.
- Extended `StatusBar`, `ZoneMap` and `GameScreen` with public warning/restricted
  urgency cues, current public damage-per-turn, sorted event banners and instant
  announcement rendering.
- No Event selection, duration, modifier, zone timing, damage, RNG or save behavior
  was changed.

## Runtime measurements

Evidence is in `output/phase4b4-browser/`; all snapshots were taken from the clean
production build served by `npm run preview` through Playwright's web server.

| Scenario | Runtime evidence |
| --- | --- |
| 1280×720 instant + persistent events | body/document scroll width 1280; announcement `emergency_broadcast`; persistent `research_anomaly` = `critical`, `区域 · 研究所`, 1 remaining; `rain` = `ambient`, `全城`, 4 remaining |
| 390×844 imminent warning | body/document scroll width 390; board client height 519px; `zoneUrgency=imminent`; bottom ActionBar remained in the scrollable layout |
| 390×844 restricted damage | body/document scroll width 390; board client height 502px; player hazard feedback present with `禁区侵蚀 −20 生命`; HP rendered 80/95 |
| Instant announcement lifecycle | visible on load fixture, still present at 4.499s, absent at 4.5s; non-modal |
| Console/page errors | 0 / 0 |

The two simultaneous persistent events are a valid saved-state evidence fixture.
The natural scheduler was not misrepresented: current event intervals are 8–14
time units while durations are at most 6, so ordinary scheduling cannot overlap two
events. The production UI is nevertheless exercised against the same validated
`activeWorldEvents` state shape; no rule or fixture-only production path was added.

The existing Phase 4B-2 encounter evidence was rerun separately to verify that the
encounter remains within its frozen height/reachability guardrail. No encounter CSS
or component was redesigned in this phase.

## Evidence grading

`CODE-VERIFIED`:

- Event severity and urgency are presentation metadata only.
- Persistent event sorting is stable and does not mutate core state.
- Instant announcement only accepts a core `WORLD_EVENT` with `metadata.instant=true`;
  no future event is predicted.
- Hazard feedback is restricted to the player's own current-time `ZONE_DAMAGE` or
  `WORLD_EVENT_DAMAGE` event.
- Unit tests cover auto-hide, severity, scope, remaining time, warning/restricted
  non-color cues and the P0 log information boundary.

`RUNTIME-VERIFIED`:

- Clean production preview evidence covers 1280×720 and 390×844, instant and
  persistent events, imminent warning, restricted damage and zero browser errors.
- P0 default-log evidence shows no NPC planner/search/pickup content.

`HUMAN-PLAYTEST-NEEDED`:

- Human review is still appropriate for event-stack density, announcement salience
  during a long ordinary playthrough, and whether the 4.5-second duration feels
  sufficient without becoming interruption fatigue.

## Information-boundary checklist

- [x] No future event kind, time or probability is rendered.
- [x] No next restricted zone is predicted before its public warning event exists.
- [x] No remote-zone detail is added beyond already public active-event scope.
- [x] No NPC position, intent, item pickup or planner reason appears in the default log.
- [x] The instant broadcast uses only the public zone-level broadcast message already
      produced by core; it does not expose identity or headcount.
- [x] Player-only hazard feedback does not expose remote NPC damage.

## Gate results

| Gate | Result |
| --- | --- |
| `npm ci` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 62 files / 1259 tests |
| `npm run build` | PASS |
| `npm run audit:save` | PASS |
| `npm run audit:deps` | PASS |
| `npm run art:doctor -- --offline` | PASS |
| `npm run art:validate` | PASS |
| `npm run art:audit:phase4a` | PASS |
| `npm run art:security:browser` | PASS |
| `npm run art:security:repo` | PASS |
| `npm run simulate -- --games 500 --seed-prefix PHASE4B4 --regression --output reports/phase4b4-balance.json` | PASS — 500/500 games, engine healthy, character balance passed |
| `npm audit --omit=dev` | PASS — 0 production vulnerabilities |

## Scope and integrity

- Image-generation API calls: **0**.
- `rain` remains fallback-only; no rain image was generated.
- Warning/restricted variants: **0** new images.
- Formal PNG files modified: **0**; all 35 formal assets remain byte-identical.
- `art/approved-assets.json` / Candidate status modified: **0**.
- `src/core/**` / `src/data/**` modified: **0**.
- Event rules, durations, modifiers, zone timing, damage, RNG and Save schema:
  **0 changes**.
- Package version and `GAME_VERSION` remain `0.3.2`.
- Phase 4B-1/4B-2/4B-3 surfaces remain frozen; no 4B-5 or 4B-6 work was pulled
  forward.
