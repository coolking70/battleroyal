import { describe, expect, it } from 'vitest';
import { getPlayer } from '../src/core/gameState';
import { handlePickupGround } from '../src/core/commandHandlers';
import { killCharacter } from '../src/core/vitals';
import { performSearch } from '../src/core/search';
import { runNpcTurn } from '../src/core/npcAi';
import { canAccessGroundItem, getLegalPlayerCommands } from '../src/core/legalActions';
import { SeededRandom } from '../src/core/random';
import { auditItemIntegrity } from '../src/core/itemIntegrity';
import { createStack } from '../src/core/inventory';
import { newGame, npcs } from './helpers';

function corpseFixture() {
  const state = newGame('PHASE4G2-CORPSE-OWNERSHIP');
  const player = getPlayer(state);
  const victim = npcs(state)[0]!;
  const bystander = npcs(state)[1]!;
  victim.currentZoneId = player.currentZoneId;
  bystander.currentZoneId = player.currentZoneId;
  // stick 不可堆叠且初始不在 NPC 背包中，确保拾取测试能观察到原始 uid。
  victim.inventory.push(createStack(state, 'stick'));
  killCharacter(state, victim, player.id, '战斗');
  const zone = state.zones[player.currentZoneId]!;
  const relic = zone.groundItems.find((stack) => stack.revealedTo !== undefined)!;
  return { state, player, victim, bystander, zone, relic };
}

describe('Phase 4G-2 corpse loot ownership', () => {
  it('killer sees and can pick immediately; pickup clears ownership fields', () => {
    const { state, player, zone, relic } = corpseFixture();

    expect(relic.droppedBy).toBe(player.id);
    expect(relic.revealedTo).toEqual([]);
    expect(canAccessGroundItem(player, relic)).toBe(true);
    expect(
      getLegalPlayerCommands(state).some(
        (entry) => entry.command.type === 'PICKUP_GROUND' && entry.command.uid === relic.uid,
      ),
    ).toBe(true);

    const result = handlePickupGround(state, player, relic.uid);
    expect(result.ok).toBe(true);
    expect(zone.groundItems.some((stack) => stack.uid === relic.uid)).toBe(false);
    expect(player.inventory.some((stack) => stack.uid === relic.uid)).toBe(true);
    const picked = player.inventory.find((stack) => stack.uid === relic.uid)!;
    expect(picked.droppedBy).toBeUndefined();
    expect(picked.revealedTo).toBeUndefined();
    expect(auditItemIntegrity(state).ok).toBe(true);
  });

  it('other roles cannot see or pick before searching, then only the searching role is revealed', () => {
    const { state, player, bystander, zone, relic } = corpseFixture();
    const other = npcs(state)[2]!;
    other.currentZoneId = player.currentZoneId;

    expect(canAccessGroundItem(bystander, relic)).toBe(false);
    expect(canAccessGroundItem(other, relic)).toBe(false);
    expect(zone.groundItems.some((stack) => stack.uid === relic.uid)).toBe(true);

    performSearch(state, bystander, new SeededRandom('PHASE4G2-SEARCH-REVEAL'));

    expect(relic.revealedTo).toContain(bystander.id);
    expect(canAccessGroundItem(bystander, relic)).toBe(true);
    expect(canAccessGroundItem(other, relic)).toBe(false);
    expect(auditItemIntegrity(state).ok).toBe(true);
  });

  it('NPC autoLoot is blocked before search and succeeds after its own search', () => {
    const { state, player, bystander, zone } = corpseFixture();
    // 选用不作为任何现有配方原料的成品，避免 NPC 随后的既有合成决策
    // 把刚拾取的物品用于制作，测试只观察拾取门槛。
    const relic = createStack(state, 'field_spear');
    relic.droppedBy = player.id;
    relic.revealedTo = [];
    zone.groundItems.push(relic);
    bystander.currentZoneId = player.currentZoneId;
    bystander.inventory = [];

    runNpcTurn(state, bystander, new SeededRandom('PHASE4G2-NPC-BEFORE'));
    expect(zone.groundItems.some((stack) => stack.uid === relic.uid)).toBe(true);
    expect(bystander.inventory.some((stack) => stack.itemId === relic.itemId)).toBe(false);

    // NPC 的完整回合可能按既有决策移动；夹具把它放回遗物所在区域，
    // 只验证搜索揭示后自动拾取门槛，不改变生产决策。
    bystander.currentZoneId = player.currentZoneId;
    performSearch(state, bystander, new SeededRandom('PHASE4G2-NPC-SEARCH'));
    expect(relic.revealedTo).toContain(bystander.id);
    bystander.currentZoneId = player.currentZoneId;
    runNpcTurn(state, bystander, new SeededRandom('PHASE4G2-NPC-AFTER'));

    expect(zone.groundItems.some((stack) => stack.uid === relic.uid)).toBe(false);
    expect(
      [...bystander.inventory, ...bystander.equipment].some(
        (stack) => stack.itemId === relic.itemId,
      ),
    ).toBe(true);
    expect(
      [...bystander.inventory, ...bystander.equipment].every(
        (stack) => stack.droppedBy === undefined && stack.revealedTo === undefined,
      ),
    ).toBe(true);
    expect(auditItemIntegrity(state).ok).toBe(true);
  });

  it('ordinary non-corpse ground drops remain accessible without a search', () => {
    const state = newGame('PHASE4G2-ORDINARY-DROP');
    const player = getPlayer(state);
    const npc = npcs(state)[0]!;
    npc.currentZoneId = player.currentZoneId;
    const stack = createStack(state, 'wood');
    state.zones[player.currentZoneId]!.groundItems.push(stack);

    expect(canAccessGroundItem(npc, stack)).toBe(true);
    runNpcTurn(state, npc, new SeededRandom('PHASE4G2-ORDINARY-NPC'));
    expect(state.zones[player.currentZoneId]!.groundItems.some((s) => s.uid === stack.uid)).toBe(false);
    expect(auditItemIntegrity(state).ok).toBe(true);
  });

  it('search reveal is deterministic and does not change the search result RNG stream', () => {
    const a = newGame('PHASE4G2-DETERMINISM');
    const b = structuredClone(a) as typeof a;
    const actorA = getPlayer(a);
    const actorB = getPlayer(b);
    const corpseA = createStack(a, 'wood');
    const corpseB = createStack(b, 'wood');
    corpseA.droppedBy = 'n1';
    corpseA.revealedTo = [];
    corpseB.droppedBy = 'n1';
    corpseB.revealedTo = [];
    a.zones[actorA.currentZoneId]!.groundItems.push(corpseA);
    b.zones[actorB.currentZoneId]!.groundItems.push(corpseB);

    const outcomeA = performSearch(a, actorA, new SeededRandom('PHASE4G2-SAME-RNG'));
    const outcomeB = performSearch(b, actorB, new SeededRandom('PHASE4G2-SAME-RNG'));
    expect(outcomeA).toEqual(outcomeB);
    expect(a.zones[actorA.currentZoneId]!.groundItems).toEqual(
      b.zones[actorB.currentZoneId]!.groundItems,
    );
  });
});
