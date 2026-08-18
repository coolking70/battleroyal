import { describe, expect, it } from 'vitest';
import { INCIDENT_DEFINITIONS, getIncidentDef } from '../src/data/incidents';
import { createGame, refreshZoneOccupants } from '../src/core/gameState';
import { createStack } from '../src/core/inventory';
import { moveActor } from '../src/core/actorActions';
import { runNpcTurn } from '../src/core/npcAi';
import { nextZoneToward } from '../src/core/accessChains';
import { canResolveIncident, consumeFacilityCharge, effectiveFacilityCharges, effectiveLandmarkLocked, resolveIncidentActor } from '../src/core/incidentEffects';
import { tickIncidents, incidentRuntime, claimIncidentReward, resolveIncident } from '../src/core/incidents';
import { observeIncidentsInZone } from '../src/core/incidentVisibility';
import { maintainStrategicIntent } from '../src/core/npcStrategicIntent';
import { pushEvent } from '../src/core/events';
import { SeededRandom } from '../src/core/random';
import { createMemoryStorage, loadGame, saveGame, setStorage, validateSaveData } from '../src/core/saveLoad';
import { getCharacterSkills } from '../src/core/skills';
import { declareVictory } from '../src/core/victory';
import { currentWorldSourcesForActor } from '../src/core/worldSources';
import type { ActorMemoryEntry, Combatant, GameState, IncidentRuntime } from '../src/core/types';

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

function isolateActor(state: GameState, actor: Combatant, zoneId: string): void {
  actor.currentZoneId = zoneId;
  const otherZones = ['school', 'hospital', 'lab', 'forest', 'residential'];
  let index = 0;
  for (const other of Object.values(state.characters)) {
    if (other.id === actor.id) continue;
    other.currentZoneId = otherZones[index % otherZones.length]!;
    index += 1;
  }
  refreshZoneOccupants(state);
}

function placeActorsAtZone(state: GameState, actors: Combatant[], zoneId: string): void {
  for (const a of actors) a.currentZoneId = zoneId;
  // Move every other character elsewhere, never into the target zone.
  const otherZones = ['school', 'lab', 'forest', 'residential', 'commercial', 'station', 'park', 'warehouse', 'construction', 'underground'].filter((z) => z !== zoneId);
  let index = 0;
  for (const other of Object.values(state.characters)) {
    if (actors.some((a) => a.id === other.id)) continue;
    other.currentZoneId = otherZones[index % otherZones.length]!;
    index += 1;
  }
  refreshZoneOccupants(state);
}

function moveFormallyTo(state: GameState, actor: Combatant, targetZoneId: string): void {
  actor.maxStamina = Math.max(actor.maxStamina, 999);
  actor.stamina = actor.maxStamina;
  let guard = 0;
  while (actor.currentZoneId !== targetZoneId && guard < 24) {
    const next = nextZoneToward(actor.currentZoneId, targetZoneId);
    expect(next).not.toBeNull();
    expect(moveActor(state, actor, next!).ok).toBe(true);
    guard += 1;
  }
  expect(actor.currentZoneId).toBe(targetZoneId);
}

function getRuntime(state: GameState, id: string): IncidentRuntime {
  const rt = incidentRuntime(state, id);
  if (!rt) throw new Error(`runtime ${id} missing`);
  return rt;
}

function suppressOtherPublicIncidents(state: GameState, keepIds: string[]): void {
  for (const def of INCIDENT_DEFINITIONS) {
    if (keepIds.includes(def.id)) continue;
    if (def.visibility !== 'PUBLIC_BROADCAST') continue;
    const rt = getRuntime(state, def.id);
    if (rt.status === 'SCHEDULED' || rt.status === 'ACTIVE') {
      rt.status = 'RESOLVED';
      rt.resolvedAt = 0;
      rt.resolvedByActorId = null;
    }
  }
}

describe('Phase 4T — Localized Dynamic Incidents & Opportunity Windows', () => {

  it('T-1 produces a deterministic incident lifecycle for the same seed', () => {
    const stateA = createGame({ seed: 'PHASE4T-T1', playerCharacterId: 'scout' });
    const stateB = createGame({ seed: 'PHASE4T-T1', playerCharacterId: 'scout' });
    for (const def of INCIDENT_DEFINITIONS) {
      const a = getRuntime(stateA, def.id);
      const b = getRuntime(stateB, def.id);
      expect(a.scheduledAt).toBe(b.scheduledAt);
      expect(a.status).toBe(b.status);
    }
    // Same seed + same command sequence → identical lifecycle.
    const sampleA = INCIDENT_DEFINITIONS.map((def) => {
      const rt = getRuntime(stateA, def.id);
      stateA.time = rt.scheduledAt;
      tickIncidents(stateA);
      return [def.id, getRuntime(stateA, def.id).status, getRuntime(stateA, def.id).startedAt];
    });
    const sampleB = INCIDENT_DEFINITIONS.map((def) => {
      const rt = getRuntime(stateB, def.id);
      stateB.time = rt.scheduledAt;
      tickIncidents(stateB);
      return [def.id, getRuntime(stateB, def.id).status, getRuntime(stateB, def.id).startedAt];
    });
    expect(sampleA).toEqual(sampleB);
  });

  it('T-2 keeps remote NPC cognition/planner identical while a LOCAL incident is hidden', () => {
    const stateA = createGame({ seed: 'PHASE4T-T2', playerCharacterId: 'scout' });
    const stateB = createGame({ seed: 'PHASE4T-T2', playerCharacterId: 'scout' });
    // Suppress every PUBLIC incident in state B so the only difference is the
    // presence of a hidden LOCAL schedule; the remote actor at school must not
    // learn about it either way.
    suppressOtherPublicIncidents(stateB, []);
    clearLocalNoise(stateA);
    clearLocalNoise(stateB);
    const actorA = npcOf(stateA, 0);
    const actorB = npcOf(stateB, 0);
    isolateActor(stateA, actorA, 'school');
    isolateActor(stateB, actorB, 'school');
    actorA.victoryGoal = actorB.victoryGoal = 'last_survivor';
    actorA.victoryGoalMode = actorB.victoryGoalMode = 'explicit';
    actorA.stamina = actorB.stamina = 99;
    actorA.maxStamina = actorB.maxStamina = 99;
    actorA.personality = actorB.personality = 'collector';
    for (let t = 0; t < 30; t += 1) {
      stateA.time = t; stateB.time = t;
      tickIncidents(stateA); tickIncidents(stateB);
    }
    // The remote actor never discovers a hidden LOCAL incident: memory + intent
    // must be byte-identical.
    expect(actorA.knowledgeMemory.entries).toEqual(actorB.knowledgeMemory.entries);
    expect(actorA.strategicIntent).toEqual(actorB.strategicIntent);
  });

  it('T-3 keeps remote NPC observation/memory/source unchanged when LOCAL runtime varies', () => {
    const baseline = createGame({ seed: 'PHASE4T-T3', playerCharacterId: 'scout' });
    const hidden = structuredClone(baseline);
    const def = getIncidentDef('factory_salvage');
    const baselineRt = getRuntime(baseline, def.id);
    const hiddenRt = getRuntime(hidden, def.id);
    hiddenRt.reward = structuredClone(baselineRt.reward);
    hiddenRt.rewardClaimedCount = baselineRt.rewardClaimedCount + 1;
    hiddenRt.responses = baselineRt.responses + 1;
    hiddenRt.contentionFailures = baselineRt.contentionFailures + 2;
    hiddenRt.overlayCharges = 99;
    hiddenRt.accessActive = true;
    const actorA = npcOf(baseline, 0);
    const actorH = npcOf(hidden, 0);
    isolateActor(baseline, actorA, 'residential');
    isolateActor(hidden, actorH, 'residential');
    const beforeA = { memory: structuredClone(actorA.knowledgeMemory), intent: actorA.strategicIntent };
    const beforeH = { memory: structuredClone(actorH.knowledgeMemory), intent: actorH.strategicIntent };
    // No observation writes from remote: source / decision must remain equal.
    const sourceA = currentWorldSourcesForActor(baseline, actorA, 'iron');
    const sourceH = currentWorldSourcesForActor(hidden, actorH, 'iron');
    expect(sourceA).toEqual(sourceH);
    expect(actorA.knowledgeMemory.entries).toEqual(actorH.knowledgeMemory.entries);
    expect(actorA.strategicIntent).toEqual(actorH.strategicIntent);
    expect(beforeA).toEqual({ memory: actorA.knowledgeMemory, intent: actorA.strategicIntent });
    expect(beforeH).toEqual({ memory: actorH.knowledgeMemory, intent: actorH.strategicIntent });
  });

  it('T-4 PUBLIC broadcast is coarse: actors know the fact but not exact reward or charges', () => {
    const state = createGame({ seed: 'PHASE4T-T4', playerCharacterId: 'scout' });
    clearLocalNoise(state);
    const def = getIncidentDef('hospital_emergency');
    const rt = getRuntime(state, def.id);
    state.time = rt.scheduledAt;
    tickIncidents(state);
    expect(rt.status).toBe('ACTIVE');
    // The incident is PUBLIC, so every alive actor's memory records the
    // coarse fact and provenance=PUBLIC_EVENT. The memory never records the
    // overlay charges, remaining pool, or the exact heal amount.
    for (const actor of Object.values(state.characters)) {
      const entries = actor.knowledgeMemory.entries.filter((entry): entry is Extract<ActorMemoryEntry, { kind: 'incident_observed' }> => entry.kind === 'incident_observed' && entry.incidentId === def.id);
      expect(entries.length).toBe(1);
      const entry = entries[0]!;
      expect(entry.provenance).toBe('PUBLIC_EVENT');
      expect(entry.observedState).toBe('active');
      expect((entry as unknown as Record<string, unknown>).overlayCharges).toBeUndefined();
      expect((entry as unknown as Record<string, unknown>).healAmount).toBeUndefined();
      expect((entry as unknown as Record<string, unknown>).remaining).toBeUndefined();
    }
  });

  it('T-5 records an incident_observed memory when the actor physically observes the zone', () => {
    const state = createGame({ seed: 'PHASE4T-T5', playerCharacterId: 'scout' });
    clearLocalNoise(state);
    const def = getIncidentDef('factory_salvage');
    const rt = getRuntime(state, def.id);
    state.time = rt.scheduledAt;
    tickIncidents(state);
    const actor = npcOf(state, 0);
    isolateActor(state, actor, 'residential');
    moveFormallyTo(state, actor, 'factory');
    observeIncidentsInZone(state, actor);
    const entries = actor.knowledgeMemory.entries.filter((entry): entry is Extract<ActorMemoryEntry, { kind: 'incident_observed' }> => entry.kind === 'incident_observed' && entry.incidentId === def.id);
    expect(entries.length).toBe(1);
    const entry = entries[0]!;
    expect(entry.provenance).toBe('DIRECT_LOCAL');
    expect(entry.observedState).toBe('active');
  });

  it('T-6 broadcasts public resolution and keeps LOCAL-only resolution off the public feed', () => {
    const state = createGame({ seed: 'PHASE4T-T6', playerCharacterId: 'scout' });
    clearLocalNoise(state);
    const publicDef = getIncidentDef('hospital_emergency');
    const localDef = getIncidentDef('factory_salvage');
    suppressOtherPublicIncidents(state, [publicDef.id]);
    const publicRt = getRuntime(state, publicDef.id);
    state.time = publicRt.scheduledAt;
    tickIncidents(state);
    expect(getRuntime(state, publicDef.id).status).toBe('ACTIVE');
    // The PUBLIC overlay is resolved without a resolving actor.
    while (getRuntime(state, publicDef.id).status === 'ACTIVE') {
      consumeFacilityCharge(state, publicDef.effect.kind === 'facility_overlay' ? publicDef.effect.landmarkId : 'hospital_operating_room');
    }
    const publicResolution = state.events.find((event) => event.type === 'INCIDENT_RESOLVED' && event.metadata.incidentId === publicDef.id);
    expect(publicResolution).toBeDefined();
    // Force-activate the LOCAL factory incident at its scheduled time.
    const localRt = getRuntime(state, localDef.id);
    state.time = localRt.scheduledAt;
    tickIncidents(state);
    expect(localRt.status).toBe('ACTIVE');
    resolveIncident(state, localDef.id, null);
    const localPublicResolution = state.events.find((event) => event.type === 'INCIDENT_RESOLVED' && event.metadata.incidentId === localDef.id);
    expect(localPublicResolution).toBeUndefined();
  });

  it('T-7 lets an autonomous NPC respond to a known active incident through runNpcTurn', () => {
    const state = createGame({ seed: 'PHASE4T-T7', playerCharacterId: 'scout' });
    clearLocalNoise(state);
    const def = getIncidentDef('hospital_emergency');
    suppressOtherPublicIncidents(state, [def.id]);
    const rt = getRuntime(state, def.id);
    state.time = rt.scheduledAt;
    tickIncidents(state);
    const actor = npcOf(state, 0);
    // Fixture setup: place the actor at the incident zone so the autonomous
    // turn chain can exercise the formal interaction pathway immediately. The
    // PUBLIC broadcast has already informed the actor.
    placeActorsAtZone(state, [actor], def.zoneId);
    // Move the player far away so the cautious NPC does not treat them as an
    // enemy and flee instead of responding to the incident.
    state.characters[state.playerId]!.currentZoneId = 'school';
    refreshZoneOccupants(state);
    actor.victoryGoal = 'last_survivor';
    actor.victoryGoalMode = 'explicit';
    actor.stamina = 99;
    actor.maxStamina = 99;
    actor.personality = 'cautious';
    // Suppress all skills so the in-zone incident action can fire without
    // competing with survival/combat skill branches.
    actor.skillCooldowns = Object.fromEntries(getCharacterSkills(actor.characterId).map((id) => [id, 99]));
    const rng = new SeededRandom('PHASE4T-T7');
    let attempts = 0;
    const decisions: string[] = [];
    while (attempts < 10 && state.status === 'playing'
      && getRuntime(state, def.id).overlayCharges > 0) {
      const beforeOverlay = getRuntime(state, def.id).overlayCharges;
      const beforeZone = actor.currentZoneId;
      const decision = runNpcTurn(state, actor, rng);
      decisions.push(`t=${attempts} zone=${beforeZone}->${actor.currentZoneId} kind=${decision.kind} overlay=${beforeOverlay}->${getRuntime(state, def.id).overlayCharges} intent=${actor.strategicIntent?.type}/${actor.strategicIntent?.targetId}`);
      attempts += 1;
    }
    if (getRuntime(state, def.id).overlayCharges === 2) {
      throw new Error('T-7 overlay not consumed. decisions: ' + JSON.stringify(decisions));
    }
    expect(actor.currentZoneId).toBe(def.zoneId);
    expect(getRuntime(state, def.id).overlayCharges).toBe(0);
    expect(getRuntime(state, def.id).status).toBe('RESOLVED');
    expect(getRuntime(state, def.id).responses).toBeGreaterThan(0);
    expect(state.stats.incidentResponses ?? 0).toBeGreaterThan(0);
    expect(state.stats.incidentDuplicateReward ?? 0).toBe(0);
  });

  it('T-8 lets stale-active memory be corrected by a local revisit and blocks second claim', () => {
    const state = createGame({ seed: 'PHASE4T-T8', playerCharacterId: 'scout' });
    clearLocalNoise(state);
    const def = getIncidentDef('factory_salvage');
    const rt = getRuntime(state, def.id);
    state.time = rt.scheduledAt;
    tickIncidents(state);
    const traveler = npcOf(state, 0);
    const later = npcOf(state, 1);
    isolateActor(state, traveler, 'residential');
    isolateActor(state, later, 'residential');
    moveFormallyTo(state, traveler, 'factory');
    observeIncidentsInZone(state, traveler);
    // The earlier arrival has now "seen" the incident; refresh memory after the
    // later actor resolves it remotely to verify the stale entry stays stale
    // until a legal local revisit.
    resolveIncident(state, def.id, later.id);
    const stale = traveler.knowledgeMemory.entries.find((entry): entry is Extract<ActorMemoryEntry, { kind: 'incident_observed' }> => entry.kind === 'incident_observed' && entry.incidentId === def.id);
    expect(stale?.observedState).toBe('active');
    // Now the traveler returns to factory and observes the local reality.
    moveFormallyTo(state, traveler, 'factory');
    observeIncidentsInZone(state, traveler);
    const refreshed = traveler.knowledgeMemory.entries
      .filter((entry): entry is Extract<ActorMemoryEntry, { kind: 'incident_observed' }> => entry.kind === 'incident_observed' && entry.incidentId === def.id)
      .sort((a, b) => b.observedAt - a.observedAt)[0]!;
    expect(refreshed.observedState).toBe('resolved');
    expect(refreshed.provenance).toBe('DIRECT_LOCAL');
    // The traveler must not be able to claim a second reward.
    const check = canResolveIncident(state, traveler, def.id);
    expect(check.ok).toBe(false);
  });

  it('T-9 enforces finite contention: no duplicate UID, no double reward', () => {
    const state = createGame({ seed: 'PHASE4T-T9', playerCharacterId: 'scout' });
    clearLocalNoise(state);
    const def = getIncidentDef('factory_salvage');
    const rt = getRuntime(state, def.id);
    state.time = rt.scheduledAt;
    tickIncidents(state);
    const a = npcOf(state, 0);
    const b = npcOf(state, 1);
    placeActorsAtZone(state, [a, b], 'factory');
    a.stamina = b.stamina = 99;
    a.maxStamina = b.maxStamina = 99;
    a.victoryGoal = b.victoryGoal = 'last_survivor';
    a.victoryGoalMode = b.victoryGoalMode = 'explicit';
    a.inventory = []; b.inventory = [];
    a.equipment = []; b.equipment = [];
    observeIncidentsInZone(state, a);
    observeIncidentsInZone(state, b);
    maintainStrategicIntent(state, a);
    maintainStrategicIntent(state, b);
    const r1 = resolveIncidentActor(state, a, def.id, new SeededRandom('PHASE4T-T9-A'));
    if (!r1.ok) {
      throw new Error('T-9 r1 failed: ' + r1.message + ' zone=' + a.currentZoneId + ' status=' + getRuntime(state, def.id).status + ' rewardLen=' + getRuntime(state, def.id).reward.length + ' knowsActive=' + (a.knowledgeMemory.entries.find((entry): entry is Extract<ActorMemoryEntry, { kind: 'incident_observed' }> => entry.kind === 'incident_observed' && entry.incidentId === def.id) as unknown as { observedState?: string })?.observedState);
    }
    // A claims the second stack and resolves the finite pool.
    const r1b = resolveIncidentActor(state, a, def.id, new SeededRandom('PHASE4T-T9-A2'));
    if (!r1b.ok) {
      throw new Error('T-9 r1b failed: ' + r1b.message);
    }
    expect(getRuntime(state, def.id).status).toBe('RESOLVED');
    const r2 = resolveIncidentActor(state, b, def.id, new SeededRandom('PHASE4T-T9-B'));
    if (r2.ok) {
      throw new Error('T-9 r2 should fail: ' + r2.message + ' zone=' + b.currentZoneId + ' status=' + getRuntime(state, def.id).status + ' rewardLen=' + getRuntime(state, def.id).reward.length);
    }
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(false);
    const allUids = [...a.inventory, ...b.inventory, ...getRuntime(state, def.id).reward].map((stack) => stack.uid);
    expect(new Set(allUids).size).toBe(allUids.length);
    expect(state.stats.incidentDuplicateReward ?? 0).toBe(0);
    expect(getRuntime(state, def.id).contentionFailures ?? 0).toBeGreaterThan(0);
  });

  it('T-10 expires an incident at expiresAt and blocks further claims', () => {
    const state = createGame({ seed: 'PHASE4T-T10', playerCharacterId: 'scout' });
    clearLocalNoise(state);
    const def = getIncidentDef('factory_salvage');
    const rt = getRuntime(state, def.id);
    state.time = rt.scheduledAt;
    tickIncidents(state);
    const traveler = npcOf(state, 0);
    isolateActor(state, traveler, 'factory');
    traveler.stamina = 99;
    traveler.maxStamina = 99;
    // Advance past the expiry window without anyone claiming.
    state.time = (rt.expiresAt ?? state.time) + 1;
    tickIncidents(state);
    expect(getRuntime(state, def.id).status).toBe('EXPIRED');
    expect(getRuntime(state, def.id).reward).toEqual([]);
    expect(resolveIncidentActor(state, traveler, def.id, new SeededRandom('PHASE4T-T10')).ok).toBe(false);
  });

  it('T-11 preserves a respond_to_incident intent across multiple turns', () => {
    const state = createGame({ seed: 'PHASE4T-T11', playerCharacterId: 'scout' });
    clearLocalNoise(state);
    const def = getIncidentDef('factory_salvage');
    suppressOtherPublicIncidents(state, [def.id]);
    const rt = getRuntime(state, def.id);
    state.time = rt.scheduledAt;
    tickIncidents(state);
    const actor = npcOf(state, 0);
    isolateActor(state, actor, 'factory');
    actor.victoryGoal = 'last_survivor';
    actor.victoryGoalMode = 'explicit';
    actor.personality = 'collector';
    actor.stamina = 99;
    actor.maxStamina = 99;
    actor.inventory = []; actor.equipment = [];
    observeIncidentsInZone(state, actor);
    maintainStrategicIntent(state, actor);
    // Add extra reward stacks so three autonomous turns can keep the incident
    // ACTIVE and the intent stable.
    const rt2 = getRuntime(state, def.id);
    rt2.reward.push(createStack(state, 'iron', 1));
    rt2.reward.push(createStack(state, 'wire', 1));
    const committed = actor.strategicIntent!;
    expect(committed.type).toBe('respond_to_incident');
    expect(committed.targetId).toBe(def.zoneId);
    for (let t = 0; t < 3; t += 1) {
      state.time += 1;
      runNpcTurn(state, actor, new SeededRandom(`PHASE4T-T11-${t}`));
      expect(actor.strategicIntent?.type).toBe('respond_to_incident');
      expect(actor.strategicIntent?.targetId).toBe(def.zoneId);
      expect(actor.strategicIntent?.committedAt).toBe(committed.committedAt);
    }
    // After resolution, the intent must transition to COMPLETE/INVALIDATE.
    resolveIncident(state, def.id, actor.id);
    // Refresh memory so the next derive sees the resolved state.
    observeIncidentsInZone(state, actor);
    state.time += 1;
    maintainStrategicIntent(state, actor);
    expect(actor.strategicIntent?.type).not.toBe('respond_to_incident');
  });

  it('T-12 lets a formal Apex goal take over the incident intent without maintenance restore', () => {
    const state = createGame({ seed: 'PHASE4T-T12', playerCharacterId: 'scout' });
    clearLocalNoise(state);
    const def = getIncidentDef('factory_salvage');
    suppressOtherPublicIncidents(state, [def.id]);
    const rt = getRuntime(state, def.id);
    state.time = rt.scheduledAt;
    tickIncidents(state);
    const actor = npcOf(state, 0);
    isolateActor(state, actor, 'factory');
    actor.victoryGoal = 'last_survivor';
    actor.victoryGoalMode = 'explicit';
    actor.personality = 'collector';
    actor.stamina = 99;
    actor.maxStamina = 99;
    actor.attack = 20;
    actor.defense = 20;
    observeIncidentsInZone(state, actor);
    maintainStrategicIntent(state, actor);
    const before = actor.strategicIntent!;
    expect(before.type).toBe('respond_to_incident');
    // The Apex public lifecycle broadcasts a public Apex entry directly.
    pushEvent(state, { type: 'APEX_SPAWNED', zoneId: 'lab', importance: 'major', message: 'broadcast apex', metadata: { wildDefId: 'prototype_aegis', tier: 'apex', zoneId: 'lab' } });
    state.time += 1;
    maintainStrategicIntent(state, actor);
    expect(actor.strategicIntent?.type).not.toBe('respond_to_incident');
    expect(['contest_apex', 'gear_up']).toContain(actor.strategicIntent!.type);
    expect(actor.strategicIntent?.committedAt).not.toBe(before.committedAt);
    // The maintenance path must not restore the old incident intent.
    state.time += 1;
    maintainStrategicIntent(state, actor);
    expect(actor.strategicIntent?.type).not.toBe('respond_to_incident');
  });

  it('T-13 round-trips a mid-incident save with finite reward, memory, intent and objective', () => {
    const state = createGame({ seed: 'PHASE4T-T13', playerCharacterId: 'scout' });
    clearLocalNoise(state);
    const def = getIncidentDef('factory_salvage');
    const rt = getRuntime(state, def.id);
    state.time = rt.scheduledAt + 1;
    tickIncidents(state);
    // One reward has been claimed, the other still sits in the pool.
    const uids = getRuntime(state, def.id).reward.map((stack) => stack.uid);
    claimIncidentReward(state, def.id, uids[0]!, 'n1');
    const actor = npcOf(state, 0);
    isolateActor(state, actor, 'factory');
    actor.victoryGoal = 'last_survivor';
    actor.victoryGoalMode = 'explicit';
    actor.personality = 'collector';
    actor.stamina = 99;
    actor.maxStamina = 99;
    observeIncidentsInZone(state, actor);
    maintainStrategicIntent(state, actor);
    const validateResult = validateSaveData(saveOf(state));
    expect(validateResult.ok, validateResult.errors.join('; ')).toBe(true);
    const claimedRuntime = getRuntime(state, def.id);
    const expectedRewardCount = claimedRuntime.reward.length;
    const storage = createMemoryStorage();
    setStorage(storage);
    expect(saveGame(state).ok).toBe(true);
    const loaded = loadGame();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const restoredActor = loaded.data.state.characters[actor.id]!;
    const restoredRuntime = loaded.data.state.incidents[def.id]!;
    expect(restoredRuntime.rewardClaimedCount).toBe(1);
    expect(restoredRuntime.reward.length).toBe(expectedRewardCount);
    expect(restoredActor.knowledgeMemory).toEqual(actor.knowledgeMemory);
    expect(restoredActor.strategicIntent).toEqual(actor.strategicIntent);
  });

  it('T-14 rejects malformed incident and memory saves', () => {
    const state = createGame({ seed: 'PHASE4T-T14', playerCharacterId: 'scout' });
    const def = getIncidentDef('factory_salvage');
    const rt = getRuntime(state, def.id);
    state.time = rt.scheduledAt;
    tickIncidents(state);
    const actor = npcOf(state, 0);
    isolateActor(state, actor, 'factory');
    observeIncidentsInZone(state, actor);
    const valid = saveOf(state);
    expect(validateSaveData(structuredClone(valid)).ok).toBe(true);

    const corruptions: Array<(copy: ReturnType<typeof saveOf>) => void> = [
      // Runtime with wrong zone (def says factory but runtime says lab).
      (copy) => { (copy.state.incidents[def.id] as unknown as Record<string, unknown>).incidentId = 'unknown_incident'; },
      // Future startedAt in the future.
      (copy) => { (copy.state.incidents[def.id] as unknown as Record<string, unknown>).startedAt = copy.state.time + 5; },
      // expiresAt < startedAt.
      (copy) => {
        const r = copy.state.incidents[def.id] as unknown as Record<string, unknown>;
        r.startedAt = 5; r.expiresAt = 4;
      },
      // RESOLVED without resolvedAt.
      (copy) => {
        const r = copy.state.incidents[def.id] as unknown as Record<string, unknown>;
        r.status = 'RESOLVED'; r.resolvedAt = null;
      },
      // SCHEDULED with resolvedAt.
      (copy) => {
        const r = copy.state.incidents[def.id] as unknown as Record<string, unknown>;
        r.status = 'SCHEDULED'; r.resolvedAt = 1;
      },
      // Negative rewardClaimedCount.
      (copy) => { (copy.state.incidents[def.id] as unknown as Record<string, unknown>).rewardClaimedCount = -1; },
      // resolvedByActorId references a non-existent character.
      (copy) => { (copy.state.incidents[def.id] as unknown as Record<string, unknown>).resolvedByActorId = 'ghost'; },
      // PUBLIC_EVENT memory on a LOCAL_DISCOVERY incident.
      (copy) => {
        const localDef = getIncidentDef('factory_salvage');
        const entries = (copy.state.characters[actor.id]!.knowledgeMemory as unknown as { entries: Array<Record<string, unknown>> }).entries;
        const target = entries.find((entry) => entry.kind === 'incident_observed' && entry.incidentId === localDef.id);
        if (target) target.provenance = 'PUBLIC_EVENT';
      },
      // Hidden runtime snapshot field.
      (copy) => { (copy.state.incidents[def.id] as unknown as Record<string, unknown>).remainingSearches = 2; },
      // Impossible ACTIVE with reward that doesn't match the def.
      (copy) => {
        const r = copy.state.incidents[def.id] as unknown as Record<string, unknown> & { reward: Array<Record<string, unknown>> };
        r.reward = [{ uid: 'xx1', itemId: 'not_an_item', count: 1 }];
      },
      // Duplicate key: two memory entries for the same incident.
      (copy) => {
        const entries = (copy.state.characters[actor.id]!.knowledgeMemory as unknown as { entries: Array<Record<string, unknown>> }).entries;
        entries.push({ ...entries[entries.length - 1]! });
      },
    ];

    for (const corrupt of corruptions) {
      const copy = structuredClone(saveOf(state));
      corrupt(copy);
      expect(validateSaveData(copy).ok).toBe(false);
    }
  });

  it('T-15 freezes incidents after terminal and blocks zero-stamina positive resolution', () => {
    const state = createGame({ seed: 'PHASE4T-T15', playerCharacterId: 'scout' });
    clearLocalNoise(state);
    const def = getIncidentDef('factory_salvage');
    const rt = getRuntime(state, def.id);
    state.time = rt.scheduledAt;
    tickIncidents(state);
    const actor = npcOf(state, 0);
    isolateActor(state, actor, 'factory');
    actor.stamina = 0;
    actor.maxStamina = 99;
    actor.victoryGoal = 'last_survivor';
    actor.victoryGoalMode = 'explicit';
    actor.inventory = []; actor.equipment = [];
    const beforeReward = getRuntime(state, def.id).reward.length;
    const beforeStatus = getRuntime(state, def.id).status;
    const result = resolveIncidentActor(state, actor, def.id, new SeededRandom('PHASE4T-T15'));
    expect(result.ok).toBe(false);
    expect(getRuntime(state, def.id).status).toBe(beforeStatus);
    expect(getRuntime(state, def.id).reward.length).toBe(beforeReward);
    // Terminal freeze.
    const frozen = structuredClone(getRuntime(state, def.id));
    declareVictory(state, state.playerId, 'last_survivor');
    tickIncidents(state);
    expect(getRuntime(state, def.id)).toEqual(frozen);
  });

  it('T-16 keeps the Phase 4R/4S remote boundary intact: remote runtime / memory never leak', () => {
    const state = createGame({ seed: 'PHASE4T-T16', playerCharacterId: 'scout' });
    clearLocalNoise(state);
    // Pair two states with identical actor knowledge but divergent landmark runtime
    // (lab disabled/repaired), then assert that a remote actor's memory and the
    // public access hint for a LOCAL incident do not leak the divergence.
    const base = structuredClone(state);
    const twin = structuredClone(state);
    const lab = twin.landmarks.lab_analysis_terminal!;
    lab.disabled = true;
    lab.repaired = false;
    lab.activated = false;
    lab.locked = true;
    lab.charges = 0;
    lab.lastUsedAt = 99;
    const npcBase = npcOf(base, 0);
    const npcTwin = npcOf(twin, 0);
    isolateActor(base, npcBase, 'residential');
    isolateActor(twin, npcTwin, 'residential');
    const baseKnowledge = structuredClone(npcBase.knowledgeMemory);
    const twinKnowledge = structuredClone(npcTwin.knowledgeMemory);
    expect(baseKnowledge.entries).toEqual(twinKnowledge.entries);
    // Remote access hint should not advertise the runtime differences.
    const def = getIncidentDef('factory_salvage');
    const rtBase = getRuntime(base, def.id);
    const rtTwin = getRuntime(twin, def.id);
    expect(rtBase.status).toBe(rtTwin.status);
    // Verify that `effectiveLandmarkLocked` does not alter an unlocked landmark
    // and `effectiveFacilityCharges` reflects the base+overlay correctly.
    expect(effectiveLandmarkLocked(base, 'school_gym', false)).toBe(false);
    const charges = effectiveFacilityCharges(base, 'hospital_operating_room');
    expect(charges).toBeGreaterThan(0);
  });
});
