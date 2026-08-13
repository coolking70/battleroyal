import { createGame, getPlayer, refreshZoneOccupants } from '../../src/core/gameState';
import { addItem, createStack, equipItem } from '../../src/core/inventory';
import { GAME_CONFIG, GAME_VERSION } from '../../src/data/gameConfig';
import { ZONE_IDS } from '../../src/data/zones';
import type { Combatant, GameState } from '../../src/core/types';

/**
 * Phase 4E-1 浏览器证据夹具。
 *
 * 与 4B-5 的 pendingPickupFixture 同一套路：构造**通过真实存档校验**的存档，
 * 从"继续上次对局"进入，之后所有交互都走真实 UI 与真实命令通道。
 * 直接开局硬打是不可行的 —— 遭遇、掉落、禁区收缩都会先把对局带偏，
 * 拿不到稳定可比的证据。
 */

function serialize(state: GameState): Record<string, unknown> {
  return {
    version: GAME_VERSION,
    savedAt: 1,
    seed: state.seed,
    time: state.time,
    rngState: state.rngState,
    state,
  };
}

function bareHanded(player: Combatant): void {
  player.inventory = [];
  player.equipment = [];
  player.equippedWeaponId = null;
  player.equippedArmorId = null;
  player.statusEffects = [];
}

/** 把除 keepId 之外的所有存活 NPC 挪到别的区域，避免旁人插手打乱证据。 */
function isolate(state: GameState, keepId: string): void {
  const player = getPlayer(state);
  const elsewhere = ZONE_IDS.find((id) => id !== player.currentZoneId) ?? player.currentZoneId;
  for (const c of Object.values(state.characters)) {
    if (c.id === player.id || c.id === keepId) continue;
    c.currentZoneId = elsewhere;
  }
  state.engagedWithPlayer = [keepId];
  // 手动挪人后必须重建区域存活名单，否则存档校验会判定占用不一致
  refreshZoneOccupants(state);
}

/**
 * 缺陷 A：进行中的遭遇 + 一击可杀的敌人。
 *
 * 玩家握着医疗包（改进 C 的"遭遇中快捷恢复"也用这个夹具），
 * 生命留出空缺，敌人 HP=1，攻击一次即可看到击杀是否写进战斗记录。
 */
export function killReportFixture(seed = 'PHASE4E1-KILL'): Record<string, unknown> {
  const state = createGame({ seed, playerCharacterId: 'scout', playerName: '战报验证者' });
  const player = getPlayer(state);
  bareHanded(player);

  const enemy = Object.values(state.characters).find((c) => c.id !== player.id && c.alive);
  if (!enemy) throw new Error('无法构造击杀战报夹具：没有可用 NPC');
  enemy.currentZoneId = player.currentZoneId;
  // maxHp=1 → hpRatio=1.0，永不触发 NPC 低血逃跑决策（阈值 0.22）；
  // 任何一次命中（保底 1 伤）即死，配合 95% 命中上限可在少量回合内稳定击杀。
  enemy.maxHp = 1;
  enemy.hp = 1;
  // Phase 4F-1：快捷恢复会推进时间，敌人可能先行动并从“打出 / 承受攻击”升级，
  // 从而把 1 HP 临时抬到 11 HP，破坏“一击可杀”证据。固定到满级只稳定夹具，
  // 不改变命中、伤害或击杀断言；满级不再累计经验，也不会因证据前置行动回血。
  enemy.level = GAME_CONFIG.maxLevel;
  enemy.exp = 0;
  enemy.statusEffects = [];
  isolate(state, enemy.id);

  // 玩家：强武器 + 满体力 + 生命留空缺（供遭遇中快捷恢复取证）
  const axe = createStack(state, 'stone_axe');
  addItem(player, axe);
  equipItem(player, axe.uid);
  addItem(player, createStack(state, 'medkit', 1));
  player.stamina = player.maxStamina;
  player.hp = Math.max(1, player.maxHp - 50);

  state.encounter = {
    enemyId: enemy.id,
    targetKind: 'contestant',
    zoneId: player.currentZoneId,
    startedAtTime: state.time,
    log: [`你与 ${enemy.name} 正面遭遇。`],
    resolved: false,
  };

  return serialize(state);
}

/**
 * 改进 C §3.2：候选恰好一种且不溢出 → 点击生命槽直接自动使用，不弹窗。
 * 背包只有绷带（healHp 15），生命空缺 40 > 15。
 */
export function quickRestoreAutoFixture(seed = 'PHASE4E1-QR-AUTO'): Record<string, unknown> {
  const state = createGame({ seed, playerCharacterId: 'scout', playerName: '快捷恢复验证者' });
  const player = getPlayer(state);
  bareHanded(player);
  addItem(player, createStack(state, 'bandage', 1));
  player.hp = Math.max(1, player.maxHp - 40);
  player.stamina = player.maxStamina;
  return serialize(state);
}

/**
 * 改进 C §3.3 / §3.4：多候选 → 弹小型选择窗；其中草药是双效物品，
 * 选择窗必须同时显示"生命 +10"与"体力 +10"。
 */
export function quickRestoreChooseFixture(seed = 'PHASE4E1-QR-CHOOSE'): Record<string, unknown> {
  const state = createGame({ seed, playerCharacterId: 'scout', playerName: '快捷恢复验证者' });
  const player = getPlayer(state);
  bareHanded(player);
  addItem(player, createStack(state, 'bandage', 1));
  addItem(player, createStack(state, 'medkit', 1));
  addItem(player, createStack(state, 'herb_remedy', 1));
  player.hp = Math.max(1, player.maxHp - 40);
  player.stamina = Math.max(1, player.maxStamina - 30);
  return serialize(state);
}

/**
 * 改进 B：只差一件材料的状态 —— 背包里有木棍，石头躺在地面。
 * 拾取石头这一步真实地"新获得物品"，石斧配方随之从不可做变为可做，
 * 提示必须在这一刻出现（首帧只是基线，不应有提示）。
 */
export function craftableHintFixture(seed = 'PHASE4E1-HINT'): Record<string, unknown> {
  const state = createGame({ seed, playerCharacterId: 'scout', playerName: '合成提示验证者' });
  const player = getPlayer(state);
  bareHanded(player);
  addItem(player, createStack(state, 'stick', 1));
  player.stamina = player.maxStamina;

  const zone = state.zones[player.currentZoneId];
  if (!zone) throw new Error('无法构造可合成提示夹具：玩家所在区域缺失');
  zone.groundItems = [createStack(state, 'stone', 1)];

  const enemy = Object.values(state.characters).find((c) => c.id !== player.id && c.alive);
  if (enemy) isolate(state, enemy.id);
  state.engagedWithPlayer = [];

  return serialize(state);
}
