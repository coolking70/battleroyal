# Phase 4U Report — Human-like NPC Competition

Branch: `agent/phase4u-humanlike-npc-competition` (base: `cc33895`, main after PR #27)
Draft PR: "Phase 4U: add human-like NPC competition"

## Goal

NPCs move from "completing their own goals" to "competing like players":
legal observation → ActorKnowledgeMemory → StrategicIntent → existing planner
→ formal action/command → world state. No second planner, no new subsystem.

## What changed

1. **Last-known pursuit (`npcStrategicIntent.ts`)** — hunt targets are chosen
   by deterministic scoring over the actor's OWN `actor_sighting` memory:
   freshness, topology distance to the STALE last-known zone (bounded by
   `HUNT_MAX_ZONE_DISTANCE = 4`), coarse remembered threat, own readiness
   (HP/stamina/equipment), personality weights. All personalities can now
   hunt; aggressive favors high threat, opportunist low/medium near targets,
   cautious/collector effectively only low threat, random keeps a seeded
   deterministic jitter. Never reads target live runtime.

2. **Multi-hop hunt movement (`npcDecide.ts`)** — when a `hunt_known_target`
   intent is live, the NPC advances one deterministic hop
   (`nextZoneToward`) toward the target's last-known zone from its own
   memory. Human-like gates: not while a craft route is in progress
   (aggressive excepted), not below 45% HP, not right after being beaten by
   that target (`recent_action FLEE`). Combat/research/extraction/Apex/access
   priorities unchanged and still higher.

3. **Opportunity competition (`npcStrategicIntent.ts`)** — contest_apex and
   respond_to_incident now check `rememberedThreatAtZone` (own memory):
   cautious yields on a remembered high threat; collector yields unless the
   opportunity is a finite high-value reward pool; aggressive/opportunist
   contest on.

4. **Intent lifecycle (`npcStrategicIntent.ts` / `npcKnowledge.ts`)** —
   hunt ends legally on: TTL without re-sighting (`HUNT_PURSUIT_TTL_TURNS`,
   the stale sighting is consciously discarded so the pursuit cannot be
   instantly re-committed), backing sighting evicted from memory, or a
   publicly broadcast `CHARACTER_DIED` of the target. COMMIT / PRESERVE /
   REEVALUATE / COMPLETE / INVALIDATE semantics unchanged.

5. **Save validator (`saveValidation/knowledge.ts`)** — a persisted
   `hunt_known_target` intent must be backed by the actor's own
   `actor_sighting` of that target, and the target must not be publicly known
   (to this actor) to be dead. The validator reads only the actor's memory,
   never the target's remote runtime.

6. **Legality gap fix (`incidentEffects.ts`)** — `canResolveIncident` now
   rejects when the inventory cannot accept the deterministic next reward
   stack ("背包已满"), so a legal-set RESOLVE_INCIDENT always succeeds. This
   closed the last 2 illegal-command games in the 500-game regression
   (pre-existing Phase 4T gap surfaced by the new seed set).

## Explicitly out of scope (unchanged red lines)

LLM NPC, dialogue, factions, alliances, quests, new combat, balance tuning,
Phase 4V presentation, save migration, art generation. Phase 4R/4S/4T
information boundaries, UID conservation, terminal freeze, zero-stamina
invariant, determinism, core/data ≤ 500, audit:deps R1–R4 = 0 all hold.

## Tests

`tests/phase4uCompetition.test.ts` (6 high-value cases):
- U-1 two-hop formal MOVE pursuit → arrival → real engagement.
- U-2 target secretly relocates → hunter still walks the stale path
  (school → hospital → lab) and never the real zone; pursuit ends legally.
- U-3 twin worlds with identical own memory but divergent hidden target
  position/HP/inventory → identical decision traces, memories and intents
  until re-observation.
- U-4 cautious yields a remembered high-threat opportunity;
  aggressive/opportunist engage the same situation.
- U-5 two NPCs contest one finite incident through runNpcTurn only: pool
  fully claimed, no duplicate reward, UID-conserved, formal claim events.
- U-6 same seed + same observation history → byte-identical pursuit result.

One fragile auto-equip fixture seed (`AF3-J-collector-1` → `-3`) was rotated
after intentional behavior change (same precedent as the Phase 4P seed
rotation in that file); verified the new seed passes on both this branch and
main.

## Verification

- `npm run typecheck` PASS
- `npm test` 1772 / 1772 (121 files)
- `npm run build` PASS
- `npm run audit:save` PASS (132/132 corruptions rejected)
- `npm run audit:deps` PASS (R1–R4 = 0)
- 500-game regression (`PHASE4U`): 500/500 trustworthy, engine PASS,
  illegal/timeout/hardLimit/terminalWithoutWinner/duplicateApexSpawn = 0,
  duplicateIncidentReward / illegalIncidentResolution /
  postTerminalIncidentMutation = 0.
- Balance OBSERVATION ONLY: overall win rate 4.0%; in this sample hunter had
  0 wins across its 12 games (ratio 4.00). No tuning performed.

## Deferred

LLM integration, human-like expansion beyond competition, balance tuning,
Phase 4V presentation, save migration.

## AF1 — hunt lifecycle closure

1. **Stable random hunt target** — the random-personality jitter is now keyed
   by `state.seed + actorId + subjectId` (stable across turns instead of raw
   `state.time`), and a committed hunt receives a small deterministic
   preference in `chooseHuntTarget`, so without a new observation or a legal
   invalidation the target never flips (no A→B→A churn).
2. **Restricted/unreachable routes end the hunt** — new reusable
   `nextZoneTowardUnrestricted` (public topology + public restriction state,
   BFS skipping restricted zones) powers both the decision-level hunt hop and
   intent lifecycle: when the last-known zone is restricted or cut off, the
   hunt is legally COMPLETED and the stale sighting is consciously discarded
   (no dead-intent re-commitment, no tracking of the target's real position).
   Scoring also refuses to start a hunt that has no unrestricted route.
3. **TTL semantics** — the give-up clock is now
   `state.time - latestBackingSighting.observedAt` (was `committedAt`), so a
   legal re-sighting refreshes the TTL naturally. No new persisted fields.

New regressions: AF1-1 (random target stability across turns without new
observations), AF1-2 (public restriction ends the committed hunt, sticky,
never veers toward the hidden real zone), AF1-3 (TTL clocked from the latest
sighting, distinguishing observedAt from committedAt semantics, refreshed by
re-sighting).

Verification: typecheck PASS; 1775/1775 tests; build PASS; audit:save PASS;
audit:deps R1–R4 = 0; 500-game `PHASE4U-AF1` regression 500/500 trustworthy,
engine PASS, all incident counters 0. Balance observation-only.
