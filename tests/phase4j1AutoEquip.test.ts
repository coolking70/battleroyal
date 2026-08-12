import { describe, expect, it } from 'vitest';

import { addItem, createStack } from '../src/core/inventory';
import { createGame, getPlayer } from '../src/core/gameState';
import { executeCommand } from '../src/core/gameEngine';
import { getLegalPlayerCommands } from '../src/core/legalActions';
import {
  AUTO_PLAYER_POLICIES,
  chooseEquipmentUpgradeAction,
  runAutoGame,
} from '../tools/autoPlayer';

function equipmentFixture(seed: string) {
  const state = createGame({ seed, playerCharacterId: 'scout' });
  const player = getPlayer(state);
  player.inventory = [];
  player.inventory.push(createStack(state, 'stick'));
  player.inventory.push(createStack(state, 'iron_pipe'));
  return { state, player };
}

describe('Phase 4J-1 标准自动玩家装备修复', () => {
  it.each(AUTO_PLAYER_POLICIES)('%s 在合法装备升级存在时选择 EQUIP', (policy) => {
    const { state, player } = equipmentFixture(`PHASE4J1-EQUIP-${policy}`);
    const legal = getLegalPlayerCommands(state);
    const equipActions = legal.filter((action) => action.command.type === 'EQUIP');
    const chosen = chooseEquipmentUpgradeAction(player, legal);

    expect(equipActions.length).toBe(2);
    expect(chosen?.command).toEqual({ type: 'EQUIP', uid: player.inventory[1]!.uid });
    expect(chosen?.command.type).toBe('EQUIP');

    const executed = executeCommand(state, chosen!.command);
    expect(executed.ok).toBe(true);
    expect(executed.state.events.at(-1)?.type).toBe('ITEM_EQUIPPED');
  });

  it.each([
    ['aggressive', 'PHASE4J1-AF-aggressive-0', 'fighter'],
    ['cautious', 'PHASE4J1-AF-cautious-0', 'scout'],
    ['collector', 'PHASE4J1-AF-collector-0', 'scout'],
    ['opportunist', 'PHASE4J1-AF-opportunist-0', 'engineer'],
    ['random', 'PHASE4J1-AF-random-0', 'fighter'],
  ] as const)('%s 标准对局实际发出 EQUIP', (policy, seed, characterId) => {
    const result = runAutoGame({ seed, characterId, policy });

    expect(result.trustworthy).toBe(true);
    expect(result.commandCounts.EQUIP ?? 0).toBeGreaterThan(0);
    expect(result.illegalCommands).toEqual([]);
  });

  it('没有装备升级候选时不产生 EQUIP 或非法命令', () => {
    let state = createGame({ seed: 'PHASE4J1-NO-UPGRADE', playerCharacterId: 'scout' });
    let player = getPlayer(state);
    player.inventory = [];
    const equippedStack = createStack(state, 'iron_pipe');
    addItem(player, equippedStack);
    const initialLegal = getLegalPlayerCommands(state);
    const equip = initialLegal.find(
      (action) => action.command.type === 'EQUIP' && action.command.uid === equippedStack.uid,
    );
    expect(equip).toBeDefined();
    const equipped = executeCommand(state, equip!.command);
    expect(equipped.ok).toBe(true);
    state = equipped.state;
    player = getPlayer(state);
    addItem(player, createStack(state, 'stick'));
    const legal = getLegalPlayerCommands(state);

    expect(legal.some((action) => action.command.type === 'EQUIP')).toBe(true);
    expect(chooseEquipmentUpgradeAction(player, legal)).toBeNull();

    const result = runAutoGame({
      seed: 'PHASE4J1-NO-UPGRADE-RUN',
      characterId: 'scout',
      policy: 'cautious',
    });
    expect(result.illegalCommands).toEqual([]);
    expect(result.trustworthy).toBe(true);
  });

  it('装备决策使用合法集合中的原始 EQUIP 命令', () => {
    const { state, player } = equipmentFixture('PHASE4J1-LEGAL-EQUIP');
    const legal = getLegalPlayerCommands(state);
    const chosen = chooseEquipmentUpgradeAction(player, legal)!;
    const matching = legal.find(
      (action) => JSON.stringify(action.command) === JSON.stringify(chosen.command),
    );

    expect(matching?.command.type).toBe('EQUIP');
    expect(matching?.advancesTime).toBe(false);
    expect(executeCommand(state, matching!.command).ok).toBe(true);
  });

  it('同种子、角色、策略两次运行的装备与结果完全一致', () => {
    for (const [index, policy] of AUTO_PLAYER_POLICIES.entries()) {
      const options = {
        seed: `PHASE4J1-DETERMINISTIC-${index}`,
        characterId: 'scout',
        policy,
        keepFinalState: true,
        keepEventTrace: true,
      } as const;
      const first = runAutoGame(options);
      const second = runAutoGame(options);
      expect(JSON.stringify({
        outcome: first.outcome,
        endReason: first.endReason,
        timeUsed: first.timeUsed,
        commandCounts: first.commandCounts,
        eventTrace: first.eventTrace,
        finalState: first.finalState,
      })).toBe(JSON.stringify({
        outcome: second.outcome,
        endReason: second.endReason,
        timeUsed: second.timeUsed,
        commandCounts: second.commandCounts,
        eventTrace: second.eventTrace,
        finalState: second.finalState,
      }));
    }
  });
});
