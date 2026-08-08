import { describe, expect, it } from 'vitest';
import { decideNpcAction } from '../src/core/npcDecide';
import { runNpcTurn } from '../src/core/npcAi';
import { SeededRandom } from '../src/core/random';
import { hasFieldCraftCharge } from '../src/core/skills';
import { refreshZoneOccupants } from '../src/core/gameState';
import { getCharacterDef } from '../src/data/characters';
import { clearInventory, give, newGame, npcs, player } from './helpers';

function engineerSetup() {
  const state = newGame('PHASE3A2-ENGINEER');
  const npc = configureCharacter(npcs(state)[0]!, 'engineer');
  clearInventory(npc);
  give(state, npc, 'wood');
  give(state, npc, 'stone');
  npc.plannedRecipeId = 'r_stick';
  npc.planCreatedAt = state.time;
  npc.stamina = 2;
  return { state, npc };
}

function configureCharacter<T extends ReturnType<typeof npcs>[number]>(npc: T, characterId: string): T {
  const def = getCharacterDef(characterId);
  npc.characterId = def.id;
  npc.maxHp = def.maxHp;
  npc.hp = def.maxHp;
  npc.maxStamina = def.maxStamina;
  npc.stamina = def.maxStamina;
  npc.attack = def.attack;
  npc.defense = def.defense;
  npc.perception = def.perception;
  npc.speed = def.speed;
  npc.crafting = def.crafting;
  npc.medical = def.medical;
  npc.passiveId = def.passiveId;
  return npc;
}

describe('Phase 3A-2 NPC field_craft closure', () => {
  it('材料齐、技能 ready、技能成本付得起时，低体力不会先 REST', () => {
    const { state, npc } = engineerSetup();
    const decision = decideNpcAction(state, npc, SeededRandom.fromState(state.rngState));
    expect(decision).toMatchObject({ kind: 'use_skill', skillId: 'field_craft' });
  });

  it('field_craft 使用后下一次成功 CRAFT 免费并消费 charge', () => {
    const { state, npc } = engineerSetup();
    const rng = SeededRandom.fromState(state.rngState);
    runNpcTurn(state, npc, rng);
    expect(npc.lastAction).toBe('use_skill');
    expect(hasFieldCraftCharge(npc)).toBe(true);
    const staminaAfterSkill = npc.stamina;

    runNpcTurn(state, npc, rng);
    expect(npc.lastAction).toBe('craft');
    expect(npc.stamina).toBe(staminaAfterSkill);
    expect(hasFieldCraftCharge(npc)).toBe(false);
    expect(state.events.some((e) => e.type === 'ITEM_CRAFTED' && e.metadata.freeCraft === true)).toBe(true);
  });

  it('材料不齐时不为了刷统计使用 field_craft', () => {
    const { state, npc } = engineerSetup();
    clearInventory(npc);
    const decision = decideNpcAction(state, npc, SeededRandom.fromState(state.rngState));
    expect(decision.kind).not.toBe('use_skill');
  });

  it('field_craft 冷却中时不能使用', () => {
    const { state, npc } = engineerSetup();
    npc.skillCooldowns.field_craft = 3;
    const decision = decideNpcAction(state, npc, SeededRandom.fromState(state.rngState));
    expect(decision.kind).not.toBe('use_skill');
  });

  it('技能自身体力不足时仍 REST，不获得免费技能成本', () => {
    const { state, npc } = engineerSetup();
    npc.stamina = 1;
    const decision = decideNpcAction(state, npc, SeededRandom.fromState(state.rngState));
    expect(decision.kind).toBe('rest');
  });
});

function encounterSetup(characterId: string): { state: ReturnType<typeof newGame>; npc: ReturnType<typeof npcs>[number] } {
  const state = newGame(`PHASE3A2-RECON-${characterId}`, 'scout');
  const p = player(state);
  const npc = configureCharacter(npcs(state)[0]!, characterId);
  npc.currentZoneId = p.currentZoneId;
  npc.knownEnemies = [p.id];
  p.knownEnemies = [npc.id];
  npc.hp = npc.maxHp;
  npc.stamina = npc.maxStamina;
  state.engagedWithPlayer = [];
  state.encounter = {
    enemyId: npc.id,
    zoneId: p.currentZoneId,
    startedAtTime: state.time,
    log: [],
    resolved: false,
    reconInitiative: true,
  };
  refreshZoneOccupants(state);
  return { state, npc };
}

describe('Phase 3A-2 reconInitiative lifecycle', () => {
  it('NPC 首次回应是非攻击技能时，技能正常执行且 flag 清除', () => {
    const { state, npc } = encounterSetup('scout');
    npc.knownEnemies = [];
    const rng = SeededRandom.fromState(state.rngState);
    runNpcTurn(state, npc, rng);
    expect(npc.lastAction).toBe('use_skill');
    expect(state.encounter?.reconInitiative).toBe(false);
  });

  it('NPC 首次回应是治疗时，治疗正常执行且 flag 清除', () => {
    const { state, npc } = encounterSetup('medic');
    clearInventory(npc);
    give(state, npc, 'bandage');
    npc.hp = Math.floor(npc.maxHp * 0.2);
    const before = npc.hp;
    runNpcTurn(state, npc, SeededRandom.fromState(state.rngState));
    expect(npc.lastAction).toBe('heal');
    expect(npc.hp).toBeGreaterThan(before);
    expect(state.encounter?.reconInitiative).toBe(false);
  });

  it('NPC 首次回应原本是攻击时转为 guard，下一次行动不再被旧 flag 阻止', () => {
    const { state, npc } = encounterSetup('medic');
    const p = player(state);
    npc.personality = 'aggressive';
    npc.attack = 100;
    p.hp = p.maxHp;
    p.maxHp = Math.max(p.maxHp, 100);

    let firstWasSuppressed = false;
    const rng = SeededRandom.fromState(state.rngState);
    for (let i = 0; i < 30 && !firstWasSuppressed; i++) {
      runNpcTurn(state, npc, rng);
      firstWasSuppressed = npc.lastAction === 'guard';
      if (!firstWasSuppressed && state.encounter?.reconInitiative === true) {
        state.encounter.reconInitiative = true;
      }
    }
    expect(firstWasSuppressed).toBe(true);
    expect(state.encounter?.reconInitiative).toBe(false);

    const hpBefore = p.hp;
    let attacked = false;
    for (let i = 0; i < 40 && !attacked; i++) {
      runNpcTurn(state, npc, rng);
      attacked = npc.lastAction === 'attack';
    }
    expect(attacked).toBe(true);
    expect(p.hp).toBeLessThan(hpBefore);
  });
});
