# Phase 4O — Multiple Victory Conditions

## Status

Implementation branch: `agent/phase4o-multiple-victory-conditions`
Required final status: `NEEDS-HUMAN-PLAYTEST`

Phase 4O starts from the accepted Phase 4N merge on `main`:

- Phase 4N accepted head: `02f88b4b6edabb1f49ff3f974b402c83eeec576f`
- Phase 4N normal merge commit: `82d90d613da55ebabebb415854458e27be22adf8`
- Phase 4N PR: #21, merged after exact-head and CI verification
- Phase 4O branch base: `82d90d613da55ebabebb415854458e27be22adf8`

This report is the implementation and audit record. No accepted/production-ready
declaration is made here.

## 1. Executive Summary

Phase 4O adds exactly three individual victory routes: last survivor,
extraction, and research. All routes share one persisted, first-victory-wins
framework; no balance tuning, save migration, team mode, boss route, or new PNG
assets were introduced.

## 2. Phase 4N Merge

- PR #21 accepted head: `02f88b4b6edabb1f49ff3f974b402c83eeec576f`
- Normal merge commit: `82d90d613da55ebabebb415854458e27be22adf8`
- Phase 4O base and branch: `agent/phase4o-multiple-victory-conditions`

## Scope lock

The only new victory routes in this phase are:

1. `last_survivor`: the existing classic elimination route;
2. `extraction`: public station call, delay, and beacon extraction;
3. `research`: private research progression and lab submission.

This phase does not add team victory, a fourth route, bosses, weather-specific
wins, capture points, old-save migration, balance tuning, or new PNG assets.

## 3. Victory Architecture Audit — 20 answers

1. **Where is victory decided?** Existing `checkGameEnd()` is the end-of-turn
   boundary. It delegates contestant wins to one authoritative
   `declareVictory()` API and retains a separate no-winner defeat path.
2. **What is the persisted winner model?** `GameState` contains explicit
   `victory.winnerId`, `victory.type`, and `victory.declaredAtTime`.
3. **What is the player-facing status?** `status='won'` means the player is the
   winner; `status='lost'` means another contestant won or the player died.
4. **Can a wild enemy win?** No. Wild enemies are never contestants and are
   rejected by the victory API before mutation.
5. **How is first-victory-wins enforced?** `declareVictory()` refuses every
   later declaration once a result or non-playing status exists.
6. **How does classic victory work?** The only living contestant produces a
   `last_survivor` declaration after contestant deaths resolve.
7. **Can alternative wins happen with several contestants alive?** Yes;
   extraction and research do not require elimination.
8. **What happens when an NPC wins an alternative route?** The NPC is persisted
   as winner and the player-facing status becomes `lost`, even if alive.
9. **Where are route definitions kept?** A small victory registry defines route
   IDs, labels, commands, objective items, and disclosure semantics; core owns
   eligibility and mutation.
10. **What is the extraction location?** The existing fixed public `station`
    zone; no new zone or procedural route is introduced.
11. **How is extraction staged?** `activeExtraction` stores caller, zone, start,
    ready time, and phase. Movement, death, defeat, or beacon loss cancels it.
12. **What is public information?** Extraction call/cancel/ready/complete events
    are public and contain no inventory, HP, or research-progress disclosure.
13. **What is private information?** Research progress remains local/private
    until final completion.
14. **How are objective items represented?** `ItemCategory='objective'` is a
    formal registry category; ordinary inventory transfer handles death loot.
15. **How deep are the chains?** Extraction uses the existing battery/frame
    component chain to produce a beacon; research uses a depth-3+ chain with
    Phase 4N wild material, research notes, anomaly sample, stabilized sample,
    and research package.
16. **How are action costs enforced?** Objective commands use centralized,
    positive stamina costs; zero-cost `FLEE`/`GUARD` remain unchanged.
17. **How are legal actions authoritative?** `legalActions` calls the same core
    eligibility APIs as execution, and every listed command is executable.
18. **How do NPCs and AutoPlayer use routes?** They use the same eligibility and
    production functions with deterministic planning and no `DEBUG_GIVE`.
19. **What is saved and validated?** Victory and active extraction are persisted
    and validated; old-save migration remains `DEFERRED UNTIL PRE-RELEASE`.
20. **What is the UI contract?** Victory Paths cards derive from core/craft
    plans; extraction countdown is public, research is private, and ResultScreen
    distinguishes all three routes and alive-player NPC losses.

## 4. Unified Victory Model

`GameState.victory` is `{ winnerId, type, declaredAtTime }`, and
`GameState.activeExtraction` stores the one public extraction session.
`declareVictory()` is the only contestant-winner mutation. It validates a live
turn-order contestant, writes the result, sets player-perspective status and
endReason, emits `VICTORY_DECLARED` plus `GAME_ENDED`, and refuses later calls.

## 5. Last Survivor

`checkGameEnd()` preserves the classic rule: exactly one live contestant
produces `type='last_survivor'`. Wild enemies are isolated from
`turnOrder`/`characters` winner selection. The existing player death path stays
a no-winner `player_died` loss.

## 6. Extraction

State machine: `idle → called → ready → completed` or `cancelled`. The fixed
public zone is `station`; `EXTRACTION_DELAY=3`. `CALL_EXTRACTION` costs stamina
and leaves the beacon in inventory. While waiting, leaving, dying, or losing
the beacon cancels the call. Ready is public but not an automatic win.
`EXTRACT` requires the original caller, station, ready state, beacon, and
positive stamina; it consumes exactly one beacon before declaring extraction.

## 7. Research

The research route uses `research_notes` from the data-driven hospital/lab
objective pools plus Phase 4N wild `bio_resin` and `chemical_mix`, then
`anomaly_sample → stabilized_sample → research_package` (depth ≥3). The final
`SUBMIT_RESEARCH` action is positive-cost, lab-only, consumes one package, and
immediately declares research victory.

## 8. Objective Items

| Item | Category | Route/source |
| --- | --- | --- |
| `extraction_beacon` | `objective` | battery/frame component chain |
| `research_package` | `objective` | Phase 4N material + research chain |
| `research_notes` | material/raw | hospital and lab objective loot |

Objective items use normal inventory capacity, crafting, ground drops,
conservation, and pickup rules; they cannot be equipped or normally used.

## 9. Action Costs

Central action costs are `CALL_EXTRACTION=4`, `EXTRACT=6`, and
`SUBMIT_RESEARCH=6`. They are all positive and use the shared eligibility/pay
layer; only the pre-existing `FLEE`/zero-stamina `GUARD` exceptions remain.

## 10. Legal Actions

`legalActionBuilders.objectiveActions()` calls the same core
`canCallExtraction`, `canExtract`, and `canSubmitResearch` gates as execution.
Objective commands are omitted when ineligible, and the legal-command contract
is covered by focused tests plus the existing random-action suite.

## 11. Information Boundary

Extraction call, cancellation, ready, completion, and final victory events are
explicitly public. They expose caller/zone/countdown state only. Research
progress and inventory planning remain player-private; only final completion is
public. Result views use the same public event projection.

## 12. NPC

NPCs use deterministic shortest-path movement and the same objective eligibility
and production functions. They can carry a beacon through station call/wait/
extract and can submit a research package in the lab. Hidden player/NPC
inventory and remote wild state are not consulted.

## 13. AutoPlayer

`runAutoGame({ victoryGoal: 'extraction' | 'research', representativeBuildLoop: true })`
uses formal `SET_CRAFT_GOAL`, `CRAFT`, `MOVE`, `REST`, `CALL_EXTRACTION`,
`EXTRACT`, and `SUBMIT_RESEARCH` commands. Dedicated deterministic fixtures use
normal inventory construction, never `DEBUG_GIVE`; both representative routes
completed with zero illegal commands.

## 14. Result / Ranking Semantics

ResultScreen distinguishes last-survivor, extraction, and research. If an NPC
wins an alternative route, the player is shown as lost while still alive and
the winner is named. Alternative winners rank first without pretending other
living contestants died; remaining living contestants use deterministic
secondary ordering.

## 15. Save Current Schema

Current saves persist victory, active extraction, objective inventory/loot, and
route events. Structure, number, reference, and consistency validators reject
unknown routes, invalid winners, bad callers/times, ended active calls, and
invalid objective loot. Backward compatibility: `DEFERRED UNTIL PRE-RELEASE`.

## 16. Conservation

Calls do not duplicate beacons; failed submissions and failed extraction do not
consume objective items; successful extraction/submission consumes exactly one.
Objective inventory participates in existing death ground-drop and pickup
flows, and the item-invariant test suite remains green.

## 17. Tests

Focused coverage includes route registry/recipe depth, extraction chain and
countdown/cancellation/atomicity, research submission, NPC-alternative loss,
legal positive-cost gates, save corruption, Victory Paths UI/public countdown,
and route-specific ResultScreen copy for player and NPC outcomes. Full suite
is 100 files / 1571 tests.

## 18. 500-Game Regression

`reports/phase4o-regression.json` and `.md` contain the required 500-game run:
requested = actual = 500, trustworthy = 100%, and zero timeout, illegal,
deadlock, livelock, stalled, empty-legal-set, hard-limit, or crash cases.
Victory counts are observation only (`none=471`, `last_survivor=29` in the
standard matrix); alternative-route frequency is not a gate.

## 19. Human

Automated browser smoke is PASS and the Victory Paths cards were visually
inspected in `output/web-game/shot-0.png`. Human status remains exactly
`NEEDS-HUMAN-PLAYTEST`; see `PHASE4O_HUMAN_PLAYTEST.md`.

## 20. Deferred

Deferred: balance tuning, old-save migration, fourth/fifth routes, capture
points, faction/team victory, bosses, respawn, weather-specific wins, advanced
objective events, and production PNG generation.

## Acceptance interpretation

The acceptance bar is a deterministic production-path implementation with
focused tests for all three routes, NPC/player perspective, cancellation,
public-information boundaries, objective death transfer, save corruption,
legal-action parity, AutoPlayer closure, UI projection, and the required
500-game engine-health regression. Balance ratios remain observation-only unless
the phase prompt explicitly requires a gate.

## Verification evidence

- `npm test`: 100 files / 1571 tests passed.
- `npm run typecheck`: PASS.
- `npm run build`: PASS.
- `npm run audit:save`: 102/102 corruption cases rejected; PASS.
- `npm run audit:deps`: PASS (R1/R2/R4 zero violations; largest core/data file
  is 500 lines).
- `npm run art:doctor -- --offline`, `npm run art:validate`, and
  `npm run art:audit:phase4a`: PASS.
- `npm run art:security:browser`, `npm run art:security:repo`, and
  `npm audit --omit=dev`: PASS; production dependencies have 0 vulnerabilities.
- Required regression: `reports/phase4o-regression.json` and `.md`; 500/500
  trustworthy, 0 timeout/illegal/deadlock/livelock/stall/empty-legal-set/
  hard-limit cases, requested = actual = 500, regression gate PASS.
- Deterministic AutoPlayer representative loops: extraction and research both
  ended `won` with the matching route, no illegal commands, and formal route
  commands (`CALL_EXTRACTION` + `EXTRACT`, or `SUBMIT_RESEARCH`).
- Browser smoke: `output/web-game/shot-0.png` visibly shows all three Victory
  Paths cards; `output/web-game/state-0.json` includes the persisted victory and
  active-extraction fields; no console-error artifact was produced.
- Human visual gate remains `NEEDS-HUMAN-PLAYTEST`.
