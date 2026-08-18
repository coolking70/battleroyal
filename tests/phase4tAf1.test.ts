import { describe, expect, it } from 'vitest';
import { getIncidentDef } from '../src/data/incidents';
import { createGame, refreshZoneOccupants } from '../src/core/gameState';
import { runNpcTurn } from '../src/core/npcAi';
import { nextZoneToward } from '../src/core/accessChains';
import { resolveIncidentActor } from '../src/core/incidentEffects';
import { incidentRuntime, tickIncidents } from '../src/core/incidents';
import { incidentMemory, observeIncidentsInZone } from '../src/core/incidentVisibility';
import { maintainStrategicIntent } from '../src/core/npcStrategicIntent';
import { SeededRandom } from '../src/core/random';
import { validateSaveData } from '../src/core/saveLoad';
import { getCharacterSkills } from '../src/core/skills';
import type { Combatant, GameState, IncidentRuntime } from '../src/core/types';

/**
 * Phase 4T-AF1 — incident correctness closure regressions.
 *
 * Only high-value closures that T-1..T-16 do not already cover:
 * save semantics (PUBLIC local refresh, memory zone, intent backing, runtime
 * shape), multi-hop autonomous response, immediate self memory refresh after
 * a formal local resolution, and the lethal-hazard reward gate.
 */

function npcOf(state: GameState, index = 0): Combatant {
  return Object.values(state.characters).filter((actor) => !actor.isPlayer)[index]!;
}

function saveOf(state: GameState) {
  return { version: state.version, savedAt: 1, seed: state.seed, time: state.time, rngState: state.rngState, state };
}

function clearLocalNoise(state: GameState): void {
  state.wildEnemies = {};
  for (const zone of Object.values(state.zones)) {
    zone.wildEnemyIds = [];
    zone.groundItems = [];
  }
}

function isolateOthers(state: GameState, actor: Combatant): void {
  const otherZones = ['school', 'hospital', 'lab', 'forest', 'residential'];
  let index = 0;
  for (const other of Object.values(state.characters)) {
    if (other.id === actor.id) continue;
    other.currentZoneId = otherZones[index % otherZones.length]!;
    index += 1;
  }
  refreshZoneOccupants(state);
}

function getRuntime(state: GameState, id: string): IncidentRuntime {
  const rt = incidentRuntime(state, id);
  if (!rt) throw new Error(`runtime ${id} missing`);
  return rt;
}

function activateIncident(state: GameState, id: string): void {
  const rt = getRuntime(state, id);
  state.time = Math.max(state.time, rt.scheduledAt);
  tickIncidents(state);
  expect(getRuntime(state, id).status).toBe('ACTIVE');
}

function suppressSkills(actor: Combatant): void {
  actor.skillCooldowns = Object.fromEntries(getCharacterSkills(actor.characterId).map((id) => [id, 99]));
}

describe('Phase 4T-AF1 — incident correctness closure', () => {

  it('AF1-1 PUBLIC incident keeps a DIRECT_LOCAL active memory save-valid after arrival', () => {
    const state = createGame({ seed: 'PHASE4T-AF1-1', playerCharacterId: 'scout' });
    clearLocalNoise(state);
    const def = getIncidentDef('hospital_emergency');
    activateIncident(state, def.id);
    const actor = npcOf(state, 0);
    actor.currentZoneId = def.zoneId;
    isolateOthers(state, actor);
    // Broadcast already wrote PUBLIC_EVENT; a physical revisit upgrades the
    // same memory through DIRECT_LOCAL. Both paths are legal for PUBLIC.
    observeIncidentsInZone(state, actor);
    const entry = incidentMemory(actor, def.id)!;
    expect(entry.provenance).toBe('DIRECT_LOCAL');
    expect(entry.observedState).toBe('active');
    const result = validateSaveData(saveOf(state));
    expect(result.ok, result.errors?.join('; ')).toBe(true);
  });

  it('AF1-2 rejects an incident memory whose zoneId is legal but semantically wrong', () => {
    const state = createGame({ seed: 'PHASE4T-AF1-2', playerCharacterId: 'scout' });
    clearLocalNoise(state);
    const def = getIncidentDef('factory_salvage');
    activateIncident(state, def.id);
    const actor = npcOf(state, 0);
    actor.currentZoneId = def.zoneId;
    isolateOthers(state, actor);
    observeIncidentsInZone(state, actor);
    expect(incidentMemory(actor, def.id)).not.toBeNull();
    const copy = structuredClone(saveOf(state));
    const entries = (copy.state.characters[actor.id]!.knowledgeMemory as unknown as { entries: Array<Record<string, unknown>> }).entries;
    const entry = entries.find((candidate) => candidate.kind === 'incident_observed' && candidate.incidentId === def.id)!;
    entry.zoneId = 'lab'; // a legal zone id, but not this incident's zone
    const result = validateSaveData(copy);
    expect(result.ok).toBe(false);
  });

  it('AF1-3 NPC autonomously reaches a known incident from two hops away and interacts', () => {
    const state = createGame({ seed: 'PHASE4T-AF1-3', playerCharacterId: 'scout' });
    clearLocalNoise(state);
    // Keep every other incident dormant for the whole test window.
    for (const candidate of Object.values(state.incidents)) {
      if (candidate.incidentId !== 'lab_containment') candidate.scheduledAt = 999;
    }
    const def = getIncidentDef('lab_containment'); // PUBLIC, zone lab
    activateIncident(state, def.id);
    const actor = npcOf(state, 0);
    actor.currentZoneId = 'school'; // school -> hospital -> lab (2 hops)
    // Keep every other actor off the route so combat does not interfere.
    const farZones = ['commercial', 'station', 'park', 'warehouse', 'construction', 'residential', 'forest'];
    let farIndex = 0;
    for (const other of Object.values(state.characters)) {
      if (other.id === actor.id) continue;
      other.currentZoneId = farZones[farIndex % farZones.length]!;
      farIndex += 1;
    }
    refreshZoneOccupants(state);
    actor.victoryGoal = 'last_survivor';
    actor.victoryGoalMode = 'explicit';
    actor.personality = 'opportunist';
    actor.maxHp = 200;
    actor.hp = 200;
    actor.maxStamina = 999;
    actor.stamina = 999;
    suppressSkills(actor);
    expect(nextZoneToward('school', 'lab')).toBe('hospital');
    const rng = new SeededRandom('PHASE4T-AF1-3');
    let arrived = false;
    const trace: string[] = [];
    for (let turn = 0; turn < 40 && state.status === 'playing'; turn += 1) {
      state.time += 1;
      const decision = runNpcTurn(state, actor, rng);
      trace.push(`${decision.kind}:${actor.currentZoneId}`);
      if (actor.currentZoneId === def.zoneId) arrived = true;
      if (getRuntime(state, def.id).responses > 0) break;
    }
    expect(arrived, 'NPC never reached the incident zone: ' + trace.join(',')).toBe(true);
    expect(actor.currentZoneId).toBe(def.zoneId);
    // The formal interaction actually happened through the normal turn loop.
    expect(getRuntime(state, def.id).responses).toBeGreaterThan(0);
    expect(actor.inventory.length).toBeGreaterThan(0);
  });

  it('AF1-4 self memory flips to resolved immediately after the last local claim', () => {
    const state = createGame({ seed: 'PHASE4T-AF1-4', playerCharacterId: 'scout' });
    clearLocalNoise(state);
    const def = getIncidentDef('factory_salvage'); // LOCAL, 2 stacks
    activateIncident(state, def.id);
    const actor = npcOf(state, 0);
    actor.currentZoneId = def.zoneId;
    isolateOthers(state, actor);
    actor.victoryGoal = 'last_survivor';
    actor.victoryGoalMode = 'explicit';
    actor.personality = 'collector';
    actor.maxStamina = 999;
    actor.stamina = 999;
    observeIncidentsInZone(state, actor);
    maintainStrategicIntent(state, actor);
    expect(actor.strategicIntent?.type).toBe('respond_to_incident');
    const rng = new SeededRandom('PHASE4T-AF1-4');
    expect(resolveIncidentActor(state, actor, def.id, rng).ok).toBe(true);
    expect(getRuntime(state, def.id).status).toBe('ACTIVE');
    // The last claim resolves the pool; the actor's own memory must reflect it
    // right now — without any MOVE or another turn.
    expect(resolveIncidentActor(state, actor, def.id, rng).ok).toBe(true);
    expect(getRuntime(state, def.id).status).toBe('RESOLVED');
    const memory = incidentMemory(actor, def.id)!;
    expect(memory.observedState).toBe('resolved');
    expect(memory.provenance).toBe('DIRECT_LOCAL');
    // The intent lost its knowledge backing and was dropped immediately.
    expect(actor.strategicIntent?.type).not.toBe('respond_to_incident');
    const result = validateSaveData(saveOf(state));
    expect(result.ok, result.errors?.join('; ')).toBe(true);
  });

  it('AF1-5 a lethal hazard grants no reward and loses no UID', () => {
    const state = createGame({ seed: 'PHASE4T-AF1-5', playerCharacterId: 'scout' });
    clearLocalNoise(state);
    const def = getIncidentDef('lab_containment'); // reward_with_hazard, damage 6
    activateIncident(state, def.id);
    const actor = npcOf(state, 0);
    actor.currentZoneId = def.zoneId;
    isolateOthers(state, actor);
    actor.maxStamina = 999;
    actor.stamina = 999;
    actor.inventory = [];
    actor.equipment = [];
    actor.hp = 3; // the hazard is lethal
    const poolBefore = getRuntime(state, def.id).reward.map((stack) => stack.uid);
    const result = resolveIncidentActor(state, actor, def.id, new SeededRandom('PHASE4T-AF1-5'));
    expect(result.ok).toBe(false);
    expect(result.claimedItemId).toBeNull();
    expect(actor.alive).toBe(false);
    expect(actor.inventory).toEqual([]);
    const poolAfter = getRuntime(state, def.id).reward.map((stack) => stack.uid);
    expect(poolAfter).toEqual(poolBefore); // pool / UID untouched
    expect(getRuntime(state, def.id).rewardClaimedCount).toBe(0);
    expect(state.events.some((event) => event.type === 'INCIDENT_CLAIMED' && event.actorId === actor.id)).toBe(false);
    expect(state.stats.incidentRewardsClaimed ?? 0).toBe(0);
  });

  it('AF1-6 respond_to_incident intent requires the actor own active incident memory', () => {
    const state = createGame({ seed: 'PHASE4T-AF1-6', playerCharacterId: 'scout' });
    clearLocalNoise(state);
    const def = getIncidentDef('factory_salvage');
    activateIncident(state, def.id);
    const actor = npcOf(state, 0);
    actor.currentZoneId = def.zoneId;
    isolateOthers(state, actor);
    observeIncidentsInZone(state, actor);
    maintainStrategicIntent(state, actor);
    expect(actor.strategicIntent?.type).toBe('respond_to_incident');
    // Backed by own memory: valid.
    expect(validateSaveData(structuredClone(saveOf(state))).ok).toBe(true);
    // Strip the backing memory: the same intent must become invalid.
    const copy = structuredClone(saveOf(state));
    const memory = copy.state.characters[actor.id]!.knowledgeMemory as unknown as { entries: Array<Record<string, unknown>> };
    memory.entries = memory.entries.filter((entry) => entry.kind !== 'incident_observed');
    const result = validateSaveData(copy);
    expect(result.ok).toBe(false);
  });

  it('AF1-7 a stale active memory stays save-valid after the remote runtime ended', () => {
    const state = createGame({ seed: 'PHASE4T-AF1-7', playerCharacterId: 'scout' });
    clearLocalNoise(state);
    const def = getIncidentDef('factory_salvage'); // LOCAL, no public resolution
    activateIncident(state, def.id);
    const actor = npcOf(state, 0);
    actor.currentZoneId = def.zoneId;
    isolateOthers(state, actor);
    actor.victoryGoal = 'last_survivor';
    actor.victoryGoalMode = 'explicit';
    actor.personality = 'collector';
    observeIncidentsInZone(state, actor);
    maintainStrategicIntent(state, actor);
    expect(actor.strategicIntent?.type).toBe('respond_to_incident');
    // The window ends remotely without any claim; this actor has had no legal
    // information yet, so its memory stays stale-active.
    const rt = getRuntime(state, def.id);
    state.time = (rt.expiresAt ?? state.time) + 1;
    tickIncidents(state);
    expect(getRuntime(state, def.id).status).toBe('EXPIRED');
    expect(incidentMemory(actor, def.id)!.observedState).toBe('active');
    // Stale active memory + intent are still legal persisted knowledge.
    const result = validateSaveData(saveOf(state));
    expect(result.ok, result.errors?.join('; ')).toBe(true);
  });

  it('AF1-8 rejects malformed IncidentRuntime effect/status shapes', () => {
    const state = createGame({ seed: 'PHASE4T-AF1-8', playerCharacterId: 'scout' });
    clearLocalNoise(state);
    const rewardDef = getIncidentDef('factory_salvage');
    const overlayDef = getIncidentDef('hospital_emergency');
    const accessDef = getIncidentDef('underground_maintenance');
    activateIncident(state, rewardDef.id);
    activateIncident(state, overlayDef.id);
    activateIncident(state, accessDef.id);
    expect(validateSaveData(structuredClone(saveOf(state))).ok).toBe(true);

    const corruptions: Array<(copy: ReturnType<typeof saveOf>) => void> = [
      // scheduledAt outside the definition window.
      (copy) => { (copy.state.incidents[rewardDef.id] as unknown as Record<string, unknown>).scheduledAt = rewardDef.scheduleMax + 5; },
      // SCHEDULED with accessActive.
      (copy) => {
        const rt = copy.state.incidents[accessDef.id] as unknown as Record<string, unknown>;
        rt.status = 'SCHEDULED';
        rt.accessActive = true;
      },
      // ACTIVE reward incident with an emptied pool (should have resolved).
      (copy) => {
        (copy.state.incidents[rewardDef.id] as unknown as { reward: unknown[] }).reward = [];
      },
      // ACTIVE reward incident carrying overlay charges.
      (copy) => {
        (copy.state.incidents[rewardDef.id] as unknown as Record<string, unknown>).overlayCharges = 1;
      },
      // ACTIVE facility overlay with zero remaining charges.
      (copy) => {
        (copy.state.incidents[overlayDef.id] as unknown as Record<string, unknown>).overlayCharges = 0;
      },
      // ACTIVE access override without accessActive.
      (copy) => {
        (copy.state.incidents[accessDef.id] as unknown as Record<string, unknown>).accessActive = false;
      },
      // RESOLVED still holding accessActive.
      (copy) => {
        const rt = copy.state.incidents[accessDef.id] as unknown as Record<string, unknown>;
        rt.status = 'RESOLVED';
        rt.resolvedAt = copy.state.time;
        rt.accessActive = true;
      },
      // EXPIRED without startedAt.
      (copy) => {
        const rt = copy.state.incidents[overlayDef.id] as unknown as Record<string, unknown>;
        rt.status = 'EXPIRED';
        rt.startedAt = null;
      },
    ];
    for (const corrupt of corruptions) {
      const copy = structuredClone(saveOf(state));
      corrupt(copy);
      const result = validateSaveData(copy);
      expect(result.ok, JSON.stringify(corrupt)).toBe(false);
    }
  });

  it('AF2-1 rejects a duplicate UID inside an incident reward pool', () => {
    const state = createGame({ seed: 'PHASE4T-AF2-1', playerCharacterId: 'scout' });
    clearLocalNoise(state);
    const def = getIncidentDef('factory_salvage');
    activateIncident(state, def.id);
    expect(validateSaveData(structuredClone(saveOf(state))).ok).toBe(true);
    const copy = structuredClone(saveOf(state));
    const pool = copy.state.incidents[def.id]!.reward;
    pool.push({ ...pool[0]! }); // same uid twice inside the pool
    expect(validateSaveData(copy).ok).toBe(false);
  });

  it('AF2-2 rejects an incident reward UID colliding with inventory or landmark loot', () => {
    const state = createGame({ seed: 'PHASE4T-AF2-2', playerCharacterId: 'scout' });
    clearLocalNoise(state);
    const def = getIncidentDef('factory_salvage');
    activateIncident(state, def.id);
    const actor = npcOf(state, 0);
    actor.currentZoneId = def.zoneId;
    isolateOthers(state, actor);
    expect(actor.inventory.length).toBeGreaterThan(0);
    const landmarkStack = Object.values(state.landmarks).flatMap((rt) => rt?.loot ?? [])[0];
    expect(landmarkStack).toBeDefined();
    const inventoryCopy = structuredClone(saveOf(state));
    const poolInv = inventoryCopy.state.incidents[def.id]!.reward;
    poolInv[0]!.uid = inventoryCopy.state.characters[actor.id]!.inventory[0]!.uid;
    expect(validateSaveData(inventoryCopy).ok).toBe(false);
    const landmarkCopy = structuredClone(saveOf(state));
    const poolLm = landmarkCopy.state.incidents[def.id]!.reward;
    poolLm[0]!.uid = landmarkStack!.uid;
    expect(validateSaveData(landmarkCopy).ok).toBe(false);
  });

  it('AF2-3 rejects extra legal reward stacks and keeps honest lifecycle saves valid', () => {
    const state = createGame({ seed: 'PHASE4T-AF2-3', playerCharacterId: 'scout' });
    clearLocalNoise(state);
    const def = getIncidentDef('factory_salvage'); // iron×1 + wire×1
    activateIncident(state, def.id);
    // Honest ACTIVE save: valid.
    expect(validateSaveData(structuredClone(saveOf(state))).ok).toBe(true);
    // An extra legal iron stack exceeds the finite per-item definition.
    const extra = structuredClone(saveOf(state));
    extra.state.incidents[def.id]!.reward.push({ uid: 'af2-extra-iron', itemId: 'iron', count: 1 });
    expect(validateSaveData(extra).ok).toBe(false);
    // A multi-count stack exceeds the legal per-stack generation (count 1).
    const multiCount = structuredClone(saveOf(state));
    multiCount.state.incidents[def.id]!.reward[0]!.count = 2;
    expect(validateSaveData(multiCount).ok).toBe(false);
    // claimed beyond the finite total.
    const overClaim = structuredClone(saveOf(state));
    overClaim.state.incidents[def.id]!.rewardClaimedCount = 5;
    expect(validateSaveData(overClaim).ok).toBe(false);

    // Honest lifecycle transitions stay valid: partial claim (ACTIVE),
    // fully claimed (RESOLVED), and unclaimed expiry (EXPIRED).
    const actor = npcOf(state, 0);
    actor.currentZoneId = def.zoneId;
    isolateOthers(state, actor);
    actor.maxStamina = 999;
    actor.stamina = 999;
    observeIncidentsInZone(state, actor);
    const rng = new SeededRandom('PHASE4T-AF2-3');
    expect(resolveIncidentActor(state, actor, def.id, rng).ok).toBe(true);
    expect(getRuntime(state, def.id).status).toBe('ACTIVE');
    expect(validateSaveData(structuredClone(saveOf(state))).ok).toBe(true);
    expect(resolveIncidentActor(state, actor, def.id, rng).ok).toBe(true);
    expect(getRuntime(state, def.id).status).toBe('RESOLVED');
    expect(validateSaveData(structuredClone(saveOf(state))).ok).toBe(true);
    // A second, untouched reward incident expiring with zero claims.
    const state2 = createGame({ seed: 'PHASE4T-AF2-3b', playerCharacterId: 'scout' });
    clearLocalNoise(state2);
    const def2 = getIncidentDef('lab_containment');
    activateIncident(state2, def2.id);
    const rt2 = getRuntime(state2, def2.id);
    state2.time = (rt2.expiresAt ?? state2.time) + 1;
    tickIncidents(state2);
    expect(getRuntime(state2, def2.id).status).toBe('EXPIRED');
    expect(validateSaveData(structuredClone(saveOf(state2))).ok).toBe(true);
  });

  it('AF3-1 rejects an ACTIVE reward pool that silently lost a stack (exact conservation)', () => {
    const state = createGame({ seed: 'PHASE4T-AF3-1', playerCharacterId: 'scout' });
    clearLocalNoise(state);
    const def = getIncidentDef('factory_salvage'); // iron×1 + wire×1, totalCap 2
    activateIncident(state, def.id);
    expect(getRuntime(state, def.id).reward.length).toBe(2);
    // A stack vanishes without being claimed: 1 + 0 !== 2. The engine has no
    // legal ACTIVE loss path, so this must not load (it would let one claim
    // strand the incident in an unsavable half-resolved state).
    const copy = structuredClone(saveOf(state));
    const pool = copy.state.incidents[def.id]!.reward;
    pool.splice(0, 1);
    expect(pool.length).toBe(1);
    expect(copy.state.incidents[def.id]!.rewardClaimedCount).toBe(0);
    expect(validateSaveData(copy).ok).toBe(false);
  });

  it('AF3-2 rejects a SCHEDULED reward incident with a nonzero claimed count', () => {
    const state = createGame({ seed: 'PHASE4T-AF3-2', playerCharacterId: 'scout' });
    clearLocalNoise(state);
    const def = getIncidentDef('factory_salvage');
    expect(getRuntime(state, def.id).status).toBe('SCHEDULED');
    expect(validateSaveData(structuredClone(saveOf(state))).ok).toBe(true);
    const copy = structuredClone(saveOf(state));
    copy.state.incidents[def.id]!.rewardClaimedCount = 1;
    expect(validateSaveData(copy).ok).toBe(false);
  });
});
