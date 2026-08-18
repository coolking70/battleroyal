# Phase 4T — Localized Dynamic Incidents & Opportunity Windows

## 1. Scope

Phase 4T adds finite, per-match local incidents: a zone gets a temporary
opportunity or obstacle, actors learn about it only through legal information
(public broadcast or physical presence), they may respond through existing
formal actions, the world changes a bounded amount, and the incident ends
(resolved or expired) while the match continues.

It starts from base `61d3ad6ce1434e46454b94b102b871ee4577b084` (Phase 4S
merged main) and preserves the full Phase 4R/4S chain. No LLM, quest log,
dialogue, faction, reputation, narrative, balance tuning, production PNG,
package dependency, or old-save migration work is in scope.

## 2. Baseline

| Item | Baseline at `61d3ad6` |
| --- | --- |
| Full Vitest | 118 files / 1,719 tests PASS |
| Save audit | 119/119 malformed rejected, 0 construction failures |
| Dependency audit | 124 files, R1/R2/R3/R4 = 0, max core/data file 500 lines |
| Production PNG | 268 files, unchanged |
| package.json / lock | unchanged |

## 3. Incident architecture

```text
IncidentDefinition (static, data-driven, src/data/incidents.ts)
  → deterministic per-match schedule (seed-derived, src/core/incidents.ts)
  → IncidentRuntime lifecycle (SCHEDULED → ACTIVE → RESOLVED / EXPIRED)
  → visibility boundary (PUBLIC_BROADCAST | LOCAL_DISCOVERY)
  → actor-scoped incident_observed memory (Phase 4S ActorKnowledgeMemory)
  → thin respond_to_incident StrategicIntent preference
  → existing planner / formal actions (MOVE, SEARCH_LANDMARK,
    INTERACT_LANDMARK, RESOLVE_INCIDENT)
  → authoritative world mutation (finite reward / temporary overlay)
  → resolution / expiry
```

There is no `IncidentAI` and no incident-side execution path. The incident
layer only describes opportunities and applies bounded effects through the
shared action services; `decideNpcAction` + `runNpcTurn` still choose every
step.

## 4. Lifecycle

`SCHEDULED` → `ACTIVE` at the seed-resolved `scheduledAt`; `ACTIVE` →
`EXPIRED` at `expiresAt = startedAt + duration`; `ACTIVE` → `RESOLVED` when
the incident's own completion condition is met (reward pool fully claimed,
overlay charges fully consumed, or the access-window landmark exhausted).
Every transition is driven by `state.time` inside `tickIncidents`, which runs
from `advanceTime` only while `status === 'playing'`. No `Math.random()`,
`Date.now()`, or browser timer participates: the same seed plus the same
command sequence replays the same lifecycle (T-1).

Scheduling uses a dedicated derived RNG (`phase4t:schedule:<seed>`) so the
per-match schedule never perturbs the established loot/spawn RNG streams.
Different seeds produce different schedules within each definition's window,
which is the match-to-match variability this phase adds.

## 5. Visibility model

- `PUBLIC_BROADCAST` (`hospital_emergency`, `lab_containment`): activation,
  public resolution, and expiry emit `INCIDENT_ACTIVATED` /
  `INCIDENT_RESOLVED` / `INCIDENT_EXPIRED` and write a coarse
  `incident_observed` memory (`provenance: PUBLIC_EVENT`) to every alive
  actor. The broadcast carries only the coarse fact — incident id, zone,
  state. It never carries reward counts, overlay charges, hazard values,
  remaining uses, private progress, or another actor's inventory (T-4).
- `LOCAL_DISCOVERY` (`factory_salvage`, `underground_maintenance`): no
  global event and no auto-memory. An actor learns the incident only by
  being in the zone (`observeIncidentLocal` via `observeIncidentsInZone`,
  called from `moveActor` and the top of `runNpcTurn`), which records the
  authoritative local state at that moment (T-5).

The generic `pushEvent` → `observePublicGameEvent` hook deliberately has no
`INCIDENT_*` case, so a LOCAL incident can never leak through the global
event array into remote cognition (T-6).

## 6. Local vs public information boundary

Remote actors never read `state.incidents[id]`. Planning reads only the
actor's own bounded memory. T-2/T-3 prove that varying a remote LOCAL
incident's runtime (reward pool, claims, responses, contention counters,
overlay, access) leaves a remote actor's memory, intent, source view, and
decision byte-identical. T-4 proves the public broadcast is coarse. T-8
proves a stale `active` memory is corrected only by a legal local revisit
(`DIRECT_LOCAL` refresh) or a public resolution event.

## 7. Phase 4S memory integration

`incident_observed` is a new member of the existing `ActorObservation` union
with the stable key `incident:<incidentId>` and a bounded shape
(`incidentId`, `zoneId`, `observedState ∈ {active, resolved, expired}`,
`observedAt`, `provenance`). It uses the existing capacity-32 memory,
stable eviction, and re-observation replacement — no second memory system.
Queries (`incidentMemory`, `actorKnowsIncidentActive`,
`latestKnownActiveIncident`, `knownActiveIncidentForZone`) read only the
actor's own entries.

## 8. StrategicIntent integration

One thin intent was added: `respond_to_incident`
(`KNOWN_INCIDENT_OPPORTUNITY`, `targetId` = incident zone). It sits below
recovery, formal research/extraction goals, public Apex, threat avoidance,
and hunt, and above the generic gear-up/explore fallback, so formal
takeovers always win (T-12) and ordinary turns PRESERVE the same
`committedAt` (T-11). A personality preference gate (definition-level,
deterministic) only decides whether the actor is interested at all.

`strategicZonePreference` gives the incident zone a ×5 weight in MOVE
targeting — a preference, never a teleport. After legal resolution/expiry
refresh, the intent transitions COMPLETE/INVALIDATE and is never
maintenance-restored (T-11, T-12).

## 9. Phase 4R access-chain integration

The `underground_maintenance` incident temporarily overrides the
`underground_sealed_passage` base lock via `effectiveLandmarkLocked` — the
same landmark, the same `SEARCH_LANDMARK` action, the same finite base loot,
the same permanent exhaustion transition. No incident-specific teleport or
route exists; an actor still has to walk there through the normal zone graph
and the existing planner.

## 10. Temporary overlay vs permanent runtime

- `effectiveFacilityCharges` = base `runtime.charges` + ACTIVE
  `facility_overlay` overlay charges; `consumeFacilityCharge` spends the
  overlay first and only touches the permanent base runtime when no overlay
  remains. Expiry removes the overlay; it never "repairs" a facility that
  was legitimately drained, disabled, or repaired before (BLOCKER 7 guard).
- `effectiveLandmarkLocked` returns `false` only while an ACTIVE
  `access_override` covers the landmark; base `locked`/`disabled`/`repaired`
  runtime is untouched, and expiry simply stops overriding it.

## 11. Contention / reward integrity

Reward incidents create a finite `ItemStack[]` pool at activation through
the shared `createStack` path (real UIDs, exact counts). A claim takes the
lowest-UID stack and moves it through the official `addItem`/`canAccept`
inventory path; the pool is spliced, never cloned (T-9). A second actor
arriving after the pool is gone is rejected and counted as a contention
failure; the counter and `incidentDuplicateReward` stay 0 in regression.
Expiry discards unclaimed stacks (no duplicated leftovers, T-10) and
save/load round-trips a partially consumed pool exactly (T-13).

## 12. Save schema

`state.incidents: Record<string, IncidentRuntime>` is persisted with the
current schema. Old-save migration remains DEFERRED. The runtime is flat and
bounded: status, schedule/timestamps, resolver, four small counters, a
finite reward `ItemStack[]`, overlay charges, and the access flag. Semantic
validation lives in `src/core/saveValidation/incidents.ts` plus a new
`incident_observed` branch in `knowledge.ts`: exact key shapes, legal status
transitions, timestamp ordering, per-effect reward compatibility, no
claimable reward after RESOLVED/EXPIRED, real resolver actors, real
IncidentDefinition references, `observedAt <= state.time`, and provenance
compatible with the incident's visibility (a `PUBLIC_EVENT` memory for a
LOCAL_DISCOVERY incident is rejected).

## 13. Tests

- `tests/phase4tIncidents.test.ts` — T-1 through T-16: 16/16 PASS.
- `tests/phase4tUi.test.tsx` — 5 UI information-boundary tests PASS.
- Full Vitest: 120 files / 1,753 tests PASS.
- Phase 4S (S-1..S-15), Phase 4R (12), Phase 4R-AF1 (9), Phase 4Q AF/AF2/AF3,
  Phase 4P Apex, Phase 4O victory/terminal, Phase 4N PvE, zero-stamina,
  item integrity, determinism, and event-visibility suites all remain green.

## 14. Regression

```text
npm run simulate -- --games 500 --seed-prefix PHASE4T --regression --output reports/phase4t-regression.json
```

- requestedTotalGames = 500, actualTotalGames = 500, trustworthy 500/500
  (100%), regressionGate = PASS, engineHealthy = PASS.
- timeout, illegalState, hardLimitReached, terminalWithoutWinner,
  invalidVictoryTuple, duplicateApexSpawn, invalidApexSpawnZone: all 0.
- Incident correctness: duplicateIncidentReward = 0,
  illegalIncidentResolution = 0, postTerminalIncidentMutation = 0.
- Character balance stays OBSERVATION ONLY (ratio 4.33, no zero-win role);
  no tuning was performed.

## 15. Known observations

- The random matrix resolves/expired most incidents through expiry rather
  than autonomous NPC claims; `incidentResponses`/`incidentRewardsClaimed`
  are therefore small in the 500-game sample. The formal autonomous
  response chain is covered deterministically by T-7.
- `incidentLocalDiscoveries` is low in the random matrix because the two
  LOCAL incidents depend on an actor being in the right zone during the
  window; T-5/T-8 cover the path directly.
- Character balance ratio and zero-win observations are unchanged from
  Phase 4S and remain observation-only.
- Vite retains its pre-existing large-chunk advisory.

## 16. Deferred work

- LLM integration = DEFERRED
- human-like competition expansion = DEFERRED
- balance = OBSERVATION ONLY
- old save migration = DEFERRED
- Phase 4U = NOT STARTED

## 17. AF1 — Incident correctness closure (head 1f9de37→AF1)

独立验收在 head `1f9de37` 拒绝后，同 PR #27 内完成 AF1 修复，保留 Phase 4T
主体架构不变：

1. **PUBLIC incident 的本地观察**：save validator 不再错误拒绝
   `PUBLIC_BROADCAST + active + DIRECT_LOCAL` —— PUBLIC 事件的两种获知路径
   （PUBLIC_EVENT / DIRECT_LOCAL）均合法；LOCAL_DISCOVERY 仍只允许
   DIRECT_LOCAL。
2. **incident_observed.zoneId 语义验证**：memory.zoneId 必须等于
   IncidentDefinition.zoneId（两个 ID 各自合法但不匹配时拒绝）。
3. **NPC 多跳响应**：`npcDecide` 在 respond_to_incident intent 下、且体力
   允许时，通过既有 `nextZoneToward`（公开 zone topology 的 BFS 首跳）给出
   deterministic next hop；不新增 planner、不 teleport，受限区/战斗/Apex/
   Research/Extraction 等更高优先级不变。
4. **本人完成 LOCAL incident 后 memory 即时刷新**：RESOLVE_INCIDENT 领取
   最后奖励、SEARCH_LANDMARK 触发 access_override 完成、INTERACT_LANDMARK
   消耗完 overlay 后，立即通过既有 `observeIncidentLocal` 合法入口刷新本人
   memory（不手写 memory 状态）。
5. **reward_with_hazard 致死不发奖励**：hazard 致死后保留死亡，不发奖、不
   claim、reward pool/UID 不变、不写成功 claim 事件/观察。auto-player 同步
   不再把“致死 hazard 尝试”纳入其承诺必定成功的合法出牌集合。
6. **respond_to_incident save 语义**：intent 必须由该 actor 自己的
   incident_observed(active, zoneId=target) memory 支撑；validator 只读
   memory，绝不读 remote live runtime（stale active memory 合法）。引擎侧
   在 memory 被 eviction 或合法更新为非 active 时同步丢弃该 intent。
7. **IncidentRuntime save 收紧**：scheduledAt 必须落在 definition 窗口；
   SCHEDULED 无 accessActive；ACTIVE 奖励型必须持有非空池且无 overlay/
   access；ACTIVE facility_overlay 必须有剩余次数；ACTIVE access_override
   必须 accessActive=true；RESOLVED/EXPIRED 的 accessActive=false，EXPIRED
   保留 startedAt。
8. 顺带修复：save validator 的 `actionTargetCompatible` 缺少
   RESOLVE_INCIDENT case（成功的 RESOLVE_INCIDENT recent_action 一旦保存即
   被误拒）。

验证（AF1 head）：typecheck PASS；tests 121 files / 1761 全过（新增
`tests/phase4tAf1.test.ts` 8 例，覆盖上述 1-7 与致死不发奖）；build PASS；
audit:save PASS（132/132 拒绝对照）；audit:deps R1-R4=0；`npm audit
--omit=dev` 0 漏洞；500 局 PHASE4T-AF1 回归 500/500 trustworthy，引擎
illegal/timeout/hardLimit=0，duplicateIncidentReward /
illegalIncidentResolution / postTerminalIncidentMutation = 0；balance 仅
观察未调参。
