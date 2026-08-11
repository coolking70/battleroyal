import { describe, expect, it } from 'vitest';
import {
  attackActor,
  fleeActor,
  guardActor,
  moveActor,
  restActor,
  searchActor,
} from '../src/core/actorActions';
import { performCraft } from '../src/core/crafting';
import { refreshZoneOccupants } from '../src/core/gameState';
import { auditItemIntegrity } from '../src/core/itemIntegrity';
import {
  craftExperienceFor,
  experienceToNextLevel,
  gainExperience,
} from '../src/core/progression';
import { SeededRandom } from '../src/core/random';
import { FIELD_CRAFT_ID } from '../src/core/statusIds';
import { GAME_CONFIG } from '../src/data/gameConfig';
import { getZoneDef } from '../src/data/zones';
import { clearInventory, give, newGame, npcs, player } from './helpers';

function stageDuel(seed: string) {
  const state = newGame(seed, 'fighter');
  const attacker = player(state);
  const defender = npcs(state)[0]!;
  defender.currentZoneId = attacker.currentZoneId;
  refreshZoneOccupants(state);
  return { state, attacker, defender };
}

describe('[Phase 4F-1] 经验来源与相对量级', () => {
  it('所有角色初始为 Lv.1 / 0 EXP', () => {
    const state = newGame('PHASE4F1-INITIAL');
    for (const actor of Object.values(state.characters)) {
      expect({ level: actor.level, exp: actor.exp }).toEqual({ level: 1, exp: 0 });
    }
  });

  it('攻击结算让攻击者与承受者同步获得最高档参与经验', () => {
    const { state, attacker, defender } = stageDuel('PHASE4F1-COMBAT');
    const result = attackActor(
      state,
      attacker,
      defender,
      new SeededRandom('PHASE4F1-COMBAT-ROLL'),
      { allowCounter: false },
    );

    expect(result.ok).toBe(true);
    expect(attacker.exp).toBe(GAME_CONFIG.expCombatParticipation);
    expect(defender.exp).toBe(GAME_CONFIG.expCombatParticipation);
  });

  it('击杀在参与经验之外追加固定奖励，死亡与掉落结算仍由既有路径完成', () => {
    const { state, attacker, defender } = stageDuel('PHASE4F1-KILL');
    defender.hp = 1;
    const result = attackActor(
      state,
      attacker,
      defender,
      new SeededRandom(0, true),
      { allowCounter: false },
    );

    expect(result.ok).toBe(true);
    expect(result.targetDied).toBe(true);
    expect(attacker.exp).toBe(
      GAME_CONFIG.expCombatParticipation + GAME_CONFIG.expKillBonus,
    );
    expect(defender.exp).toBe(GAME_CONFIG.expCombatParticipation);
    expect(defender.alive).toBe(false);
    expect(state.deathOrder).toContain(defender.id);
    expect(auditItemIntegrity(state).ok).toBe(true);
  });

  it('搜索与探索获得最低档经验，休息获得 0', () => {
    const searchState = newGame('PHASE4F1-SEARCH');
    const searcher = player(searchState);
    expect(
      searchActor(searchState, searcher, new SeededRandom('PHASE4F1-SEARCH-ROLL')).ok,
    ).toBe(true);
    expect(searcher.exp).toBe(GAME_CONFIG.expSearch);

    const moveState = newGame('PHASE4F1-MOVE');
    const mover = player(moveState);
    const destination = getZoneDef(mover.currentZoneId).adjacent[0]!;
    expect(moveActor(moveState, mover, destination).ok).toBe(true);
    expect(mover.exp).toBe(GAME_CONFIG.expExplore);

    const restState = newGame('PHASE4F1-REST');
    const rester = player(restState);
    expect(restActor(restState, rester).ok).toBe(true);
    expect(rester.exp).toBe(0);
  });

  it('合成经验随成品既有 value 档次递增，且严格低于战斗与击杀奖励', () => {
    expect(craftExperienceFor('stun_rod')).toBeGreaterThan(craftExperienceFor('stick'));
    expect(GAME_CONFIG.expCombatParticipation).toBeGreaterThan(GAME_CONFIG.expKillBonus);
    expect(GAME_CONFIG.expKillBonus).toBeGreaterThan(craftExperienceFor('stun_rod'));
    expect(craftExperienceFor('stick')).toBeGreaterThan(GAME_CONFIG.expSearch);
    expect(GAME_CONFIG.expSearch).toBeGreaterThan(0);

    const lowState = newGame('PHASE4F1-CRAFT-LOW');
    const low = player(lowState);
    clearInventory(low);
    give(lowState, low, 'wood');
    give(lowState, low, 'stone');
    expect(performCraft(lowState, low, 'r_stick').ok).toBe(true);
    expect(low.exp).toBe(craftExperienceFor('stick'));

    const highState = newGame('PHASE4F1-CRAFT-HIGH');
    const high = player(highState);
    clearInventory(high);
    give(highState, high, 'battery');
    give(highState, high, 'scrap');
    expect(performCraft(highState, high, 'r_stun_rod').ok).toBe(true);
    expect(high.exp).toBe(craftExperienceFor('stun_rod'));
    expect(high.exp).toBeGreaterThan(low.exp);
  });
});

describe('[Phase 4F-1] 防刷取', () => {
  it('零体力免费防御与免费脱离均不产生经验', () => {
    const guardState = newGame('PHASE4F1-FREE-GUARD');
    const guarder = player(guardState);
    guarder.stamina = 0;
    for (let i = 0; i < 5; i += 1) {
      expect(guardActor(guardState, guarder).ok).toBe(true);
    }
    expect(guarder.exp).toBe(0);

    const { state: fleeState, attacker: fleeing, defender: enemy } =
      stageDuel('PHASE4F1-FREE-FLEE');
    fleeing.stamina = 0;
    for (const [zoneId, zone] of Object.entries(fleeState.zones)) {
      if (zoneId !== fleeing.currentZoneId) zone.status = 'restricted';
    }
    const escaped = fleeActor(
      fleeState,
      fleeing,
      enemy,
      new SeededRandom('PHASE4F1-FLEE-ROLL'),
      { allowPursuit: false },
    );
    expect(escaped.ok).toBe(true);
    expect(escaped.escaped).toBe(true);
    expect(fleeing.exp).toBe(0);
  });

  it('现场加工的零成本合成不产生经验', () => {
    const state = newGame('PHASE4F1-FREE-CRAFT', 'engineer');
    const crafter = player(state);
    clearInventory(crafter);
    give(state, crafter, 'wood');
    give(state, crafter, 'stone');
    crafter.statusEffects.push({
      id: FIELD_CRAFT_ID,
      remaining: GAME_CONFIG.skillFieldCraftDuration,
      hpPerTick: 0,
      label: '现场加工',
      remainingCrafts: 1,
    });

    expect(performCraft(state, crafter, 'r_stick').ok).toBe(true);
    expect(crafter.exp).toBe(0);
  });

  it('连续三次低阶合成的经验仍低于一次攻击参与，低阶刷取不具行动效率', () => {
    const state = newGame('PHASE4F1-LOW-CRAFT-LOOP');
    const crafter = player(state);
    clearInventory(crafter);
    give(state, crafter, 'wood', 3);
    give(state, crafter, 'stone', 3);

    for (let i = 0; i < 3; i += 1) {
      expect(performCraft(state, crafter, 'r_stick').ok).toBe(true);
    }
    expect(crafter.exp).toBe(craftExperienceFor('stick') * 3);
    expect(crafter.exp).toBeLessThan(GAME_CONFIG.expCombatParticipation);
    expect(craftExperienceFor('stick')).toBeLessThan(craftExperienceFor('stun_rod'));
  });
});

describe('[Phase 4F-1] 升级、NPC 同步与确定性', () => {
  it('升级同时提升 attack / defense / maxHp，当前 HP 同量提升', () => {
    const state = newGame('PHASE4F1-LEVEL-UP');
    const actor = player(state);
    actor.hp -= 20;
    actor.exp = experienceToNextLevel(actor.level) - 1;
    const before = {
      attack: actor.attack,
      defense: actor.defense,
      maxHp: actor.maxHp,
      hp: actor.hp,
    };

    const result = gainExperience(actor, 1);
    expect(result.levelsGained).toBe(1);
    expect(actor.level).toBe(2);
    expect(actor.exp).toBe(0);
    expect(actor.attack).toBe(before.attack + GAME_CONFIG.levelAttackGain);
    expect(actor.defense).toBe(before.defense + GAME_CONFIG.levelDefenseGain);
    expect(actor.maxHp).toBe(before.maxHp + GAME_CONFIG.levelMaxHpGain);
    expect(actor.hp).toBe(before.hp + GAME_CONFIG.levelMaxHpGain);
  });

  it('一次获得大量经验最多升至 5 级，满级后不再累计经验或属性', () => {
    const state = newGame('PHASE4F1-LEVEL-CAP');
    const actor = player(state);
    const before = {
      attack: actor.attack,
      defense: actor.defense,
      maxHp: actor.maxHp,
      hp: actor.hp,
    };
    gainExperience(actor, 10_000);

    const upgrades = GAME_CONFIG.maxLevel - 1;
    expect(actor.level).toBe(GAME_CONFIG.maxLevel);
    expect(actor.exp).toBe(0);
    expect(actor.attack).toBe(before.attack + upgrades * GAME_CONFIG.levelAttackGain);
    expect(actor.defense).toBe(before.defense + upgrades * GAME_CONFIG.levelDefenseGain);
    expect(actor.maxHp).toBe(before.maxHp + upgrades * GAME_CONFIG.levelMaxHpGain);
    expect(actor.hp).toBe(before.hp + upgrades * GAME_CONFIG.levelMaxHpGain);

    const capped = structuredClone(actor);
    expect(gainExperience(actor, 999).gained).toBe(0);
    expect(actor).toEqual(capped);
  });

  it('NPC 通过真实 attackActor 执行路径获得经验并升级', () => {
    const state = newGame('PHASE4F1-NPC-LEVEL');
    const target = player(state);
    const npc = npcs(state)[0]!;
    npc.currentZoneId = target.currentZoneId;
    npc.exp = experienceToNextLevel(npc.level) - GAME_CONFIG.expCombatParticipation;
    const before = {
      attack: npc.attack,
      defense: npc.defense,
      maxHp: npc.maxHp,
      hp: npc.hp,
    };
    refreshZoneOccupants(state);

    const result = attackActor(
      state,
      npc,
      target,
      new SeededRandom('PHASE4F1-NPC-ATTACK'),
      { allowCounter: false },
    );
    expect(result.ok).toBe(true);
    expect(npc.level).toBe(2);
    expect(npc.exp).toBe(0);
    expect(npc.attack).toBe(before.attack + GAME_CONFIG.levelAttackGain);
    expect(npc.defense).toBe(before.defense + GAME_CONFIG.levelDefenseGain);
    expect(npc.maxHp).toBe(before.maxHp + GAME_CONFIG.levelMaxHpGain);
    expect(npc.hp).toBe(before.hp + GAME_CONFIG.levelMaxHpGain);
  });

  it('同种子、同操作序列得到完全一致的成长状态与 RNG 后续状态', () => {
    const run = () => {
      const { state, attacker, defender } = stageDuel('PHASE4F1-DETERMINISM');
      const rng = new SeededRandom('PHASE4F1-DETERMINISM-ROLL');
      attackActor(state, attacker, defender, rng, { allowCounter: false });
      return { state, rngState: rng.getState() };
    };

    const first = run();
    const second = run();
    expect(second).toEqual(first);
  });

  it('经验不会写入公开战斗事件或暴露敌方精确成长值', () => {
    const { state, attacker, defender } = stageDuel('PHASE4F1-INFO-BOUNDARY');
    attackActor(
      state,
      attacker,
      defender,
      new SeededRandom('PHASE4F1-INFO-BOUNDARY-ROLL'),
      { allowCounter: false },
    );
    const publicPayload = JSON.stringify(state.events);
    expect(publicPayload).not.toMatch(/"(?:level|exp)"/);
  });
});
