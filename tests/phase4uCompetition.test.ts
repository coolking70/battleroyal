import { describe, expect, it } from 'vitest';
import { createGame, refreshZoneOccupants } from '../src/core/gameState';
import { runNpcTurn } from '../src/core/npcAi';
import { nextZoneToward } from '../src/core/accessChains';
import { incidentRuntime, tickIncidents } from '../src/core/incidents';
import { observeIncidentsInZone } from '../src/core/incidentVisibility';
import { maintainStrategicIntent } from '../src/core/npcStrategicIntent';
import { observeActorSighting } from '../src/core/npcKnowledge';
import { getCharacterSkills } from '../src/core/skills';
import { SeededRandom } from '../src/core/random';
import { validateSaveData } from '../src/core/saveLoad';
import { getIncidentDef } from '../src/data/incidents';
import { pushEvent } from '../src/core/events';
import type { Combatant, GameState, Personality } from '../src/core/types';

/**
 * Phase 4U — human-like NPC competition regressions.
 *
 * Every scenario drives NPCs only through `runNpcTurn` / formal observations;
 * hidden target runtime (position, HP, inventory) is manipulated exclusively
 * as fixture setup to prove that NPC behavior never reads it.
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

function dormantIncidents(state: GameState, keep?: string): void {
  // Stay inside the definition's legal schedule window (AF1) while never
  // activating during the short test horizon.
  for (const rt of Object.values(state.incidents)) {
    if (rt.incidentId !== keep) {
      const def = getIncidentDef(rt.incidentId);
      rt.scheduledAt = Math.max(rt.scheduledAt, def.scheduleMax);
    }
  }
}

function isolate(state: GameState, keep: Combatant[]): void {
  // Other actors go far away — never into any zone a kept actor occupies.
  const keepZones = new Set(keep.map((actor) => actor.currentZoneId));
  let index = 0;
  const others = ['commercial', 'station', 'park', 'warehouse', 'construction', 'residential', 'forest', 'underground', 'school', 'lab', 'hospital', 'factory']
    .filter((zoneId) => !keepZones.has(zoneId));
  for (const actor of Object.values(state.characters)) {
    if (keep.some((k) => k.id === actor.id)) continue;
    actor.currentZoneId = others[index % others.length]!;
    index += 1;
  }
  refreshZoneOccupants(state);
}

function primeHunter(hunter: Combatant, personality: Personality): void {
  hunter.personality = personality;
  hunter.victoryGoal = 'last_survivor';
  hunter.victoryGoalMode = 'explicit';
  hunter.maxHp = 100;
  hunter.hp = 100;
  hunter.maxStamina = 999;
  hunter.stamina = 999;
  hunter.attack = 14;
  hunter.defense = 8;
  hunter.level = 3;
  hunter.skillCooldowns = Object.fromEntries(getCharacterSkills(hunter.characterId).map((id) => [id, 99]));
}

interface TurnTrace {
  kind: string;
  zone: string;
  intent: string;
  reason: string;
}

function runTurns(
  state: GameState,
  hunter: Combatant,
  turns: number,
  tag: string,
): TurnTrace[] {
  const trace: TurnTrace[] = [];
  const rng = new SeededRandom(tag);
  for (let turn = 0; turn < turns && state.status === 'playing'; turn += 1) {
    state.time += 1;
    const decision = runNpcTurn(state, hunter, rng);
    trace.push({
      kind: decision.kind,
      zone: hunter.currentZoneId,
      intent: hunter.strategicIntent ? `${hunter.strategicIntent.type}:${hunter.strategicIntent.targetId}` : 'null',
      reason: decision.reason,
    });
  }
  return trace;
}

describe('Phase 4U — human-like NPC competition', () => {

  it('U-1 pursues a last-known target from two hops away through formal MOVE and engages', () => {
    const state = createGame({ seed: 'PHASE4U-U1', playerCharacterId: 'scout' });
    clearLocalNoise(state);
    dormantIncidents(state);
    const hunter = npcOf(state, 0);
    const target = npcOf(state, 1);
    primeHunter(hunter, 'aggressive');
    target.maxHp = 200; target.hp = 200; target.attack = 6; target.defense = 2; target.level = 1;
    // Legal sighting: they shared a zone, then the hunter left formally.
    hunter.currentZoneId = 'lab';
    target.currentZoneId = 'lab';
    isolate(state, [hunter, target]);
    observeActorSighting(state, hunter, target, 'DIRECT_LOCAL');
    let guard = 0;
    while (hunter.currentZoneId !== 'school' && guard < 8) {
      const hop = nextZoneToward(hunter.currentZoneId, 'school');
      expect(hop).not.toBeNull();
      hunter.stamina = 999;
      // Formal fixture movement away from the sighting zone.
      hunter.currentZoneId = hop!;
      refreshZoneOccupants(state);
      guard += 1;
    }
    expect(hunter.currentZoneId).toBe('school'); // ≥2 hops from lab
    isolate(state, [hunter, target]);
    const hpBefore = target.hp;
    const trace: TurnTrace[] = [];
    const rng = new SeededRandom('PHASE4U-U1');
    for (let turn = 0; turn < 12 && state.status === 'playing' && target.hp === hpBefore; turn += 1) {
      state.time += 1;
      const decision = runNpcTurn(state, hunter, rng);
      trace.push({
        kind: decision.kind,
        zone: hunter.currentZoneId,
        intent: hunter.strategicIntent ? `${hunter.strategicIntent.type}:${hunter.strategicIntent.targetId}` : 'null',
        reason: decision.reason,
      });
    }
    // The pursuit moved through formal MOVE decisions toward the last-known zone.
    expect(trace.some((step) => step.kind === 'move')).toBe(true);
    // The target stayed put, so the hunter arrives and a real engagement happens.
    expect(trace.map((step) => step.zone)).toContain('lab');
    expect(target.hp).toBeLessThan(hpBefore);
    expect(trace.some((step) => step.kind === 'attack')).toBe(true);
    // The mid-pursuit save (hunt intent backed by own sighting) stays valid.
    expect(validateSaveData(saveOf(state)).ok).toBe(true);
  });

  it('U-2 keeps pursuing the STALE last-known zone when the target secretly moved', () => {
    const state = createGame({ seed: 'PHASE4U-U2', playerCharacterId: 'scout' });
    clearLocalNoise(state);
    dormantIncidents(state);
    const hunter = npcOf(state, 0);
    const target = npcOf(state, 1);
    primeHunter(hunter, 'aggressive');
    hunter.currentZoneId = 'lab';
    target.currentZoneId = 'lab';
    isolate(state, [hunter, target]);
    observeActorSighting(state, hunter, target, 'DIRECT_LOCAL');
    hunter.currentZoneId = 'school';
    isolate(state, [hunter, target]);
    // The target secretly relocates while unobservable by the hunter.
    target.currentZoneId = 'forest';
    refreshZoneOccupants(state);
    const trace = runTurns(state, hunter, 12, 'PHASE4U-U2');
    // While the hunt intent was live, every step advanced along the public
    // topology toward the STALE zone (school → hospital → lab), never anywhere
    // that would reveal the target's real location.
    const huntSteps = trace.filter((step) => step.intent.startsWith('hunt_known_target'));
    expect(huntSteps.length).toBeGreaterThan(0);
    expect(trace[0]!.zone).toBe('hospital');
    expect(trace[1]!.zone).toBe('lab');
    for (let index = 0; index < huntSteps.length; index += 1) {
      expect(huntSteps[index]!.zone).not.toBe('forest');
    }
    // After arriving without a re-sighting, the pursuit legally ends.
    const lastIntent = trace[trace.length - 1]!.intent;
    expect(lastIntent.startsWith(`hunt_known_target:${target.id}`)).toBe(false);
  });

  it('U-3 identical own memory but divergent hidden target runtime → identical decisions', () => {
    const makeTwin = (targetZone: string, targetHp: number, withLoot: boolean) => {
      const state = createGame({ seed: 'PHASE4U-U3', playerCharacterId: 'scout' });
      clearLocalNoise(state);
      dormantIncidents(state);
      const hunter = npcOf(state, 0);
      const target = npcOf(state, 1);
      primeHunter(hunter, 'aggressive');
      hunter.currentZoneId = 'lab';
      target.currentZoneId = 'lab';
      isolate(state, [hunter, target]);
      observeActorSighting(state, hunter, target, 'DIRECT_LOCAL');
      hunter.currentZoneId = 'park'; // park → … → lab: multi-hop pursuit
      isolate(state, [hunter, target]);
      // Hidden runtime divergence the hunter must never observe.
      target.currentZoneId = targetZone;
      target.hp = targetHp;
      target.inventory = withLoot
        ? [{ ...(target.inventory[0] ?? { uid: 'u3-twin-item', itemId: 'iron', count: 1 }) }]
        : [];
      isolate(state, [hunter, target]);
      return { state, hunter };
    };
    const twinA = makeTwin('lab', 150, true);
    const twinB = makeTwin('forest', 12, false);
    const traceA = runTurns(twinA.state, twinA.hunter, 3, 'PHASE4U-U3');
    const traceB = runTurns(twinB.state, twinB.hunter, 3, 'PHASE4U-U3');
    expect(traceA).toEqual(traceB);
    expect(twinA.hunter.knowledgeMemory.entries).toEqual(twinB.hunter.knowledgeMemory.entries);
    expect(twinA.hunter.strategicIntent).toEqual(twinB.hunter.strategicIntent);
    expect(twinA.hunter.currentZoneId).toBe(twinB.hunter.currentZoneId);
    // The stale pursuit intent was live from last-known information alone.
    expect(traceA.some((step) => step.intent.startsWith('hunt_known_target'))).toBe(true);
  });

  it('U-4 cautious yields a remembered high-threat opportunity; aggressive/opportunist engage', () => {
    const build = (personality: Personality, threat: 'high' | 'medium') => {
      const state = createGame({ seed: 'PHASE4U-U4', playerCharacterId: 'scout' });
      clearLocalNoise(state);
      dormantIncidents(state, 'lab_containment');
      // A PUBLIC incident at lab that everyone legally knows.
      const rt = incidentRuntime(state, 'lab_containment')!;
      state.time = rt.scheduledAt;
      tickIncidents(state);
      const npc = npcOf(state, 0);
      const rival = npcOf(state, 1);
      primeHunter(npc, personality);
      npc.currentZoneId = 'lab';
      rival.currentZoneId = 'lab';
      isolate(state, [npc, rival]);
      // Coarse threat is derived from public combat stats only.
      const ownerPower = npc.attack + npc.defense + npc.level * 2;
      const rivalPower = threat === 'high' ? ownerPower * 1.6 : ownerPower;
      rival.attack = Math.round(rivalPower - rival.defense - rival.level * 2);
      observeActorSighting(state, npc, rival, 'DIRECT_LOCAL');
      // The NPC leaves the zone; its memory still remembers both facts.
      npc.currentZoneId = 'school';
      refreshZoneOccupants(state);
      maintainStrategicIntent(state, npc);
      return npc.strategicIntent?.type ?? 'none';
    };
    // Cautious yields the contested opportunity entirely.
    expect(['respond_to_incident', 'hunt_known_target']).not.toContain(build('cautious', 'high'));
    // Aggressive/opportunist engage the same situation (hunt or contest).
    expect(['hunt_known_target', 'respond_to_incident']).toContain(build('aggressive', 'high'));
    expect(['hunt_known_target', 'respond_to_incident']).toContain(build('opportunist', 'medium'));
  });

  it('U-5 two NPCs compete for one finite incident through formal commands only', () => {
    const state = createGame({ seed: 'PHASE4U-U5', playerCharacterId: 'scout' });
    clearLocalNoise(state);
    dormantIncidents(state, 'factory_salvage');
    const def = getIncidentDef('factory_salvage');
    const rt = incidentRuntime(state, def.id)!;
    state.time = rt.scheduledAt;
    tickIncidents(state);
    expect(rt.status).toBe('ACTIVE');
    const a = npcOf(state, 0);
    const b = npcOf(state, 1);
    for (const npc of [a, b]) {
      primeHunter(npc, 'collector');
      npc.currentZoneId = def.zoneId;
      npc.inventory = [];
      npc.equipment = [];
    }
    isolate(state, [a, b]);
    // Both locally discover the finite opportunity (legal observation entry).
    observeIncidentsInZone(state, a);
    observeIncidentsInZone(state, b);
    const rng = new SeededRandom('PHASE4U-U5');
    for (let turn = 0; turn < 10 && state.status === 'playing'
      && (incidentRuntime(state, def.id)?.status === 'ACTIVE'); turn += 1) {
      state.time += 1;
      runNpcTurn(state, a, rng);
      if (incidentRuntime(state, def.id)?.status !== 'ACTIVE') break;
      state.time += 1;
      runNpcTurn(state, b, rng);
    }
    // The finite pool was fully claimed through the formal interaction.
    expect(rt.status).toBe('RESOLVED');
    expect(rt.rewardClaimedCount).toBe(def.effect.kind === 'reward_pool'
      ? def.effect.itemIds.length * def.effect.countPerItem
      : -1);
    expect(state.stats.incidentDuplicateReward ?? 0).toBe(0);
    expect(state.stats.incidentIllegalResolution ?? 0).toBe(0);
    // No teleport: both claims were formal interactions inside the incident zone.
    const claimEvents = state.events.filter((event) => event.type === 'INCIDENT_CLAIMED' && event.metadata.incidentId === def.id);
    expect(claimEvents.length).toBe(2);
    for (const event of claimEvents) {
      expect(event.zoneId).toBe(def.zoneId);
    }
    // UID conservation across both claimers.
    const uids = [...a.inventory, ...b.inventory, ...rt.reward].map((stack) => stack.uid);
    expect(new Set(uids).size).toBe(uids.length);
    expect(a.inventory.length + b.inventory.length).toBe(2);
  });

  it('U-6 same seed and observation history → identical deterministic pursuit', () => {
    const run = () => {
      const state = createGame({ seed: 'PHASE4U-U6', playerCharacterId: 'scout' });
      clearLocalNoise(state);
      dormantIncidents(state);
      const hunter = npcOf(state, 0);
      const target = npcOf(state, 1);
      primeHunter(hunter, 'aggressive');
      hunter.currentZoneId = 'lab';
      target.currentZoneId = 'lab';
      isolate(state, [hunter, target]);
      observeActorSighting(state, hunter, target, 'DIRECT_LOCAL');
      hunter.currentZoneId = 'school';
      isolate(state, [hunter, target]);
      const trace = runTurns(state, hunter, 8, 'PHASE4U-U6');
      return {
        trace: JSON.stringify(trace),
        memory: JSON.stringify(hunter.knowledgeMemory),
        intent: JSON.stringify(hunter.strategicIntent),
        zone: hunter.currentZoneId,
        targetHp: target.hp,
      };
    };
    expect(run()).toEqual(run());
  });
});

describe('Phase 4U-AF1 — hunt lifecycle closure', () => {

  it('AF1-1 keeps a random NPC hunt target stable without new observations', () => {
    const state = createGame({ seed: 'PHASE4U-AF1-1', playerCharacterId: 'scout' });
    clearLocalNoise(state);
    dormantIncidents(state);
    const hunter = npcOf(state, 0);
    const a = npcOf(state, 1);
    const b = npcOf(state, 2);
    primeHunter(hunter, 'random');
    // Two legal sightings at equal topology distance (school → … → lab/forest
    // are both 2 hops) with identical coarse threat: near-equal candidates.
    for (const [subject, zoneId] of [[a, 'lab'], [b, 'forest']] as const) {
      hunter.currentZoneId = zoneId;
      subject.currentZoneId = zoneId;
      refreshZoneOccupants(state);
      observeActorSighting(state, hunter, subject, 'DIRECT_LOCAL');
    }
    hunter.currentZoneId = 'school';
    isolate(state, [hunter, a, b]);
    const targets: string[] = [];
    for (let turn = 0; turn < 6; turn += 1) {
      state.time += 1;
      maintainStrategicIntent(state, hunter);
      const hunt = hunter.strategicIntent;
      targets.push(hunt?.type === 'hunt_known_target' && typeof hunt.targetId === 'string'
        ? hunt.targetId
        : 'none');
    }
    expect(new Set(targets).size).toBe(1);
    expect(targets[0]).not.toBe('none');
  });

  it('AF1-2 ends a hunt when the last-known zone becomes publicly unreachable', () => {
    const state = createGame({ seed: 'PHASE4U-AF1-2', playerCharacterId: 'scout' });
    clearLocalNoise(state);
    dormantIncidents(state);
    const hunter = npcOf(state, 0);
    const target = npcOf(state, 1);
    primeHunter(hunter, 'aggressive');
    hunter.currentZoneId = 'lab';
    target.currentZoneId = 'lab';
    refreshZoneOccupants(state);
    observeActorSighting(state, hunter, target, 'DIRECT_LOCAL');
    hunter.currentZoneId = 'school';
    isolate(state, [hunter, target]);
    maintainStrategicIntent(state, hunter);
    expect(hunter.strategicIntent?.type).toBe('hunt_known_target');
    // The last-known zone becomes a public restricted zone (public broadcast).
    target.currentZoneId = 'warehouse'; // vacate lab first (hidden relocation)
    isolate(state, [hunter, target]);
    const labZone = state.zones['lab']!;
    labZone.status = 'restricted';
    labZone.restrictedAtTime = state.time;
    pushEvent(state, {
      type: 'ZONE_RESTRICTED', zoneId: 'lab', importance: 'major',
      message: '研究所已成为禁区。', metadata: { zoneId: 'lab' },
    });
    maintainStrategicIntent(state, hunter);
    expect(hunter.strategicIntent?.type).not.toBe('hunt_known_target');
    // The give-up is sticky: no dead-intent re-commitment on later turns.
    for (let turn = 0; turn < 3; turn += 1) {
      state.time += 1;
      maintainStrategicIntent(state, hunter);
      expect(hunter.strategicIntent?.type).not.toBe('hunt_known_target');
    }
    // The hunter never turns toward the target's real (unknown) new zone.
    const rng = new SeededRandom('PHASE4U-AF1-2');
    for (let turn = 0; turn < 6 && state.status === 'playing'; turn += 1) {
      state.time += 1;
      runNpcTurn(state, hunter, rng);
      expect(hunter.currentZoneId).not.toBe('warehouse');
    }
  });

  it('AF1-3 clocks hunt TTL from the latest backing sighting, refreshed by re-sighting', () => {
    const state = createGame({ seed: 'PHASE4U-AF1-3', playerCharacterId: 'scout' });
    clearLocalNoise(state);
    dormantIncidents(state);
    const hunter = npcOf(state, 0);
    const target = npcOf(state, 1);
    primeHunter(hunter, 'aggressive');
    hunter.currentZoneId = 'lab';
    target.currentZoneId = 'lab';
    refreshZoneOccupants(state);
    observeActorSighting(state, hunter, target, 'DIRECT_LOCAL');
    hunter.currentZoneId = 'school';
    isolate(state, [hunter, target]);
    // Sighting observedAt = T0, but the hunt is only committed 5 turns later:
    // a committedAt clock would survive until T0+5+8; the sighting clock must
    // give up at T0+9.
    state.time += 5;
    maintainStrategicIntent(state, hunter);
    expect(hunter.strategicIntent?.type).toBe('hunt_known_target');
    state.time += 3; // sighting age 8 — still legal
    maintainStrategicIntent(state, hunter);
    expect(hunter.strategicIntent?.type).toBe('hunt_known_target');
    state.time += 1; // sighting age 9 — TTL exceeded
    maintainStrategicIntent(state, hunter);
    expect(hunter.strategicIntent?.type).not.toBe('hunt_known_target');
    // A legal re-sighting restarts the clock naturally.
    hunter.currentZoneId = 'hospital';
    target.currentZoneId = 'hospital';
    refreshZoneOccupants(state);
    observeActorSighting(state, hunter, target, 'DIRECT_LOCAL');
    hunter.currentZoneId = 'school';
    isolate(state, [hunter, target]);
    maintainStrategicIntent(state, hunter);
    expect(hunter.strategicIntent?.type).toBe('hunt_known_target');
    state.time += 8;
    maintainStrategicIntent(state, hunter);
    expect(hunter.strategicIntent?.type).toBe('hunt_known_target');
    state.time += 1;
    maintainStrategicIntent(state, hunter);
    expect(hunter.strategicIntent?.type).not.toBe('hunt_known_target');
  });
});
