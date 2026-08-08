/**
 * Phase 3 · 存档独立验收脚本。
 *
 * 不依赖 Vitest：本脚本自行生成一份**正常状态**，然后制造 N 种损坏状态，
 * 逐一调用权威入口 `validateSaveData`，把结果写入：
 *   reports/save-validation-audit.json
 *   reports/save-validation-audit.md
 *
 * 判定规则：
 *   - 正常状态必须被接受（expected=true）；
 *   - 每一种损坏状态必须被拒绝（expected=false）；
 *   - 任何「应当被拒却被接受」的存档 → 进程以 exit code 1 退出。
 *
 * ── P3-P2：用例构造失败不再被当成「通过」（Phase 3 Preflight）──────────────
 * 旧实现是：
 *     try { c.mutate(save); } catch { return { passed: true, actual: false } }
 * 也就是说，只要构造损坏存档的代码自己抛了异常（写错字段名、改了数据结构、
 * 索引越界……），审计就**默认它通过**。这等于用工具自身的 bug 伪造了一条
 * 绿色记录 —— 校验器可能根本没被调用过。
 *
 * Phase 3 起：
 *   - mutate 抛异常 ⇒ `constructionFailed = true`、`actual = null`、`passed = false`
 *   - 只要存在任何一条构造失败，`npm run audit:save` 必须以 exit code 1 退出
 *   - 报告中单列「构造失败」一节，不与「校验漏判」混为一谈
 * ─────────────────────────────────────────────────────────────────────────
 *
 * 用法：
 *   npm run audit:save
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { GAME_CONFIG, GAME_VERSION } from '../src/data/gameConfig';
import { newGame } from '../tests/helpers';
import { validateSaveData } from '../src/core/saveLoad';
import type { GameState } from '../src/core/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/* ------------------------------------------------------------------ */
/* 存档构造                                                            */
/* ------------------------------------------------------------------ */

interface AuditSave {
  version: string;
  savedAt: number;
  seed: string;
  time: number;
  rngState: number;
  state: GameState;
}

/** 生成一份完全合法的存档（深度克隆 state，便于定向损坏） */
function makeValidSave(seed = 'BR-AUDIT-CTRL'): AuditSave {
  const state = newGame(seed);
  return {
    version: state.version,
    savedAt: Date.now(),
    seed: state.seed,
    time: state.time,
    rngState: state.rngState,
    state: structuredClone(state) as GameState,
  };
}

/* ------------------------------------------------------------------ */
/* 用例                                                                */
/* ------------------------------------------------------------------ */

interface AuditCase {
  case: string;
  expected: boolean;
  /** 在合法存档的克隆上制造损坏 */
  mutate: (s: AuditSave) => void;
}

interface AuditResult {
  case: string;
  expected: boolean;
  /**
   * 校验器的真实结论：`true` = 接受，`false` = 拒绝。
   * `null` 表示**校验器根本没被调用**——用例构造阶段就抛异常了（见 P3-P2）。
   */
  actual: boolean | null;
  passed: boolean;
  errorMessage: string | null;
  /** 用例构造失败标记：这是审计工具自身的缺陷，必须让整轮审计 FAIL */
  constructionFailed: boolean;
}

/** 一整轮审计的结论 */
interface AuditRun {
  control: AuditResult;
  results: AuditResult[];
  /** passed=false 的用例（含校验漏判与构造失败） */
  failed: AuditResult[];
  /** 仅构造失败的用例 */
  constructionFailures: AuditResult[];
  /** 整轮判定：对照通过 && 无任何失败用例 */
  passed: boolean;
}

/* 便捷别名：state 内的类型化入口 */
type Mutable = Record<string, unknown>;

const CASES: AuditCase[] = [
  /* ---- 顶层结构（P1-1） ---- */
  { case: '缺 savedAt', expected: false, mutate: (s) => { delete (s as unknown as Mutable).savedAt; } },
  { case: 'savedAt 为 NaN', expected: false, mutate: (s) => { (s as unknown as Mutable).savedAt = NaN; } },
  { case: 'savedAt 为负数', expected: false, mutate: (s) => { (s as unknown as Mutable).savedAt = -1; } },
  { case: '顶层 seed 为空串', expected: false, mutate: (s) => { (s as unknown as Mutable).seed = ''; } },
  { case: '顶层 time 为负数', expected: false, mutate: (s) => { (s as unknown as Mutable).time = -5; } },
  { case: '顶层 time 与 state 不一致', expected: false, mutate: (s) => { (s as unknown as Mutable).time = s.state.time + 1; } },
  { case: '顶层 seed 与 state 不一致', expected: false, mutate: (s) => { (s as unknown as Mutable).seed = 'MISMATCH'; } },
  { case: '顶层 rngState 与 state 不一致', expected: false, mutate: (s) => { (s as unknown as Mutable).rngState = s.state.rngState + 1; } },
  { case: '顶层 rngState 为字符串', expected: false, mutate: (s) => { (s as unknown as Mutable).rngState = 'abc'; } },
  { case: '版本不受支持', expected: false, mutate: (s) => { (s as unknown as Mutable).version = '9.9.9'; } },

  /* ---- 数值层（P1-2/3/6/7） ---- */
  { case: '背包 9 格（超上限）', expected: false, mutate: (s) => {
    const p = s.state.characters[s.state.playerId]!;
    while (p.inventory.length < GAME_CONFIG.inventorySlots + 1) {
      p.inventory.push({ uid: `x${p.inventory.length}`, itemId: 'wood', count: 1 });
    }
  } },
  { case: '物品 count=0', expected: false, mutate: (s) => {
    const p = s.state.characters[s.state.playerId]!;
    p.inventory[0]!.count = 0;
  } },
  { case: '物品 count 超过 maxStack', expected: false, mutate: (s) => {
    const p = s.state.characters[s.state.playerId]!;
    p.inventory.push({ uid: 'big', itemId: 'wood', count: 99 });
  } },
  { case: '不可堆叠物品 count=2', expected: false, mutate: (s) => {
    const p = s.state.characters[s.state.playerId]!;
    p.inventory.push({ uid: 'stick-2', itemId: 'stick', count: 2 });
  } },
  { case: '武器缺少耐久', expected: false, mutate: (s) => {
    const p = s.state.characters[s.state.playerId]!;
    p.inventory.push({ uid: 'nodu', itemId: 'stick', count: 1 });
  } },
  { case: '武器耐久越界', expected: false, mutate: (s) => {
    const p = s.state.characters[s.state.playerId]!;
    p.inventory.push({ uid: 'du', itemId: 'stick', count: 1, durability: 999 });
  } },
  { case: '非武器带耐久字段', expected: false, mutate: (s) => {
    const p = s.state.characters[s.state.playerId]!;
    p.inventory.push({ uid: 'm', itemId: 'wood', count: 1, durability: 5 });
  } },
  { case: '负 eventSeq', expected: false, mutate: (s) => { s.state.eventSeq = -1; } },
  { case: '负 uidSeq', expected: false, mutate: (s) => { s.state.uidSeq = -3; } },
  { case: '负 nextZoneEventTime', expected: false, mutate: (s) => { s.state.nextZoneEventTime = -2; } },
  { case: 'endedAtTime 晚于 state.time', expected: false, mutate: (s) => {
    s.state.endedAtTime = s.state.time + 5;
  } },
  { case: '进行中对局带 endedAtTime', expected: false, mutate: (s) => {
    s.state.status = 'playing';
    s.state.endedAtTime = 3;
  } },
  { case: '负 stats.searches', expected: false, mutate: (s) => {
    s.state.characters[s.state.playerId]!.stats.searches = -1;
  } },
  { case: '负 stats.damageDealt', expected: false, mutate: (s) => {
    s.state.characters[s.state.playerId]!.stats.damageDealt = -5.5;
  } },
  { case: '负 kills', expected: false, mutate: (s) => {
    s.state.characters[s.state.playerId]!.kills = -1;
  } },
  { case: '已死亡但 hp>0', expected: false, mutate: (s) => {
    const npc = Object.values(s.state.characters).find((c) => !c.isPlayer)!;
    npc.alive = false;
    npc.hp = 50;
    npc.diedAtTime = s.state.time;
  } },
  { case: '存活却带 diedAtTime', expected: false, mutate: (s) => {
    const p = s.state.characters[s.state.playerId]!;
    p.diedAtTime = s.state.time;
  } },
  { case: '已死亡但缺 diedAtTime', expected: false, mutate: (s) => {
    const npc = Object.values(s.state.characters).find((c) => !c.isPlayer)!;
    npc.alive = false;
    npc.hp = 0;
    npc.diedAtTime = null;
  } },

  /* ---- 区域库存（P1-7） ---- */
  { case: '区域 loot count=0', expected: false, mutate: (s) => {
    const z = Object.values(s.state.zones)[0]!;
    z.loot[0]!.count = 0;
  } },
  { case: '区域 loot 未知物品', expected: false, mutate: (s) => {
    const z = Object.values(s.state.zones)[0]!;
    z.loot[0]!.itemId = 'no_such_item';
  } },
  { case: '区域 loot 稀有度非法', expected: false, mutate: (s) => {
    const z = Object.values(s.state.zones)[0]!;
    (z.loot[0] as unknown as { rarity: string }).rarity = 'epic';
  } },
  { case: 'remainingLootCount 为负', expected: false, mutate: (s) => {
    Object.values(s.state.zones)[0]!.remainingLootCount = -1;
  } },
  { case: 'initialLootCount 为负', expected: false, mutate: (s) => {
    Object.values(s.state.zones)[0]!.initialLootCount = -1;
  } },
  { case: 'remaining > initial', expected: false, mutate: (s) => {
    const z = Object.values(s.state.zones)[0]!;
    z.remainingLootCount = z.initialLootCount + 10;
  } },
  { case: 'supply 与派生比例不符', expected: false, mutate: (s) => {
    Object.values(s.state.zones)[0]!.supply = 0.42;
  } },
  { case: 'supply 越界', expected: false, mutate: (s) => {
    Object.values(s.state.zones)[0]!.supply = 2.5;
  } },

  /* ---- 引用层（P1-4/5/9/10/11/12/13） ---- */
  { case: 'equippedWeaponId 指向非武器', expected: false, mutate: (s) => {
    const p = s.state.characters[s.state.playerId]!;
    p.equipment = [{ uid: 'armor-x', itemId: 'cloth_armor', count: 1 }];
    p.equippedWeaponId = 'armor-x';
  } },
  { case: 'equipment 出现 material', expected: false, mutate: (s) => {
    const p = s.state.characters[s.state.playerId]!;
    p.equipment = [{ uid: 'mat', itemId: 'wood', count: 1 }];
    p.equippedWeaponId = null;
    p.equippedArmorId = null;
  } },
  { case: '重复事件 ID', expected: false, mutate: (s) => {
    s.state.events.push(structuredClone(s.state.events[0]!));
  } },
  { case: '事件类型非法', expected: false, mutate: (s) => {
    (s.state.events[0] as unknown as { type: string }).type = 'HACKED';
  } },
  { case: '事件时间晚于当前', expected: false, mutate: (s) => {
    s.state.events[0]!.time = s.state.time + 99;
  } },
  { case: '错误事件 actor', expected: false, mutate: (s) => {
    s.state.events[0]!.actorId = 'ghost';
  } },
  { case: '事件 message 非字符串', expected: false, mutate: (s) => {
    (s.state.events[0] as unknown as { message: number }).message = 123;
  } },
  { case: '事件 metadata 不可序列化', expected: false, mutate: (s) => {
    (s.state.events[0] as unknown as { metadata: Record<string, unknown> }).metadata = { nested: { a: 1 } };
  } },
  { case: 'NPC 有目标但缺 planCreatedAt', expected: false, mutate: (s) => {
    const npc = Object.values(s.state.characters).find((c) => !c.isPlayer)!;
    npc.plannedRecipeId = 'r_stick';
    npc.planCreatedAt = null;
    npc.planReason = 'x';
  } },
  { case: 'NPC 有目标但 planReason 为空', expected: false, mutate: (s) => {
    const npc = Object.values(s.state.characters).find((c) => !c.isPlayer)!;
    npc.plannedRecipeId = 'r_stick';
    npc.planCreatedAt = 0;
    npc.planReason = '';
  } },
  { case: '非法玩家制作目标', expected: false, mutate: (s) => {
    s.state.craftGoalRecipeId = 'recipe_does_not_exist';
  } },
  { case: 'craftGoalCompleted=true 但无目标', expected: false, mutate: (s) => {
    s.state.craftGoalRecipeId = null;
    s.state.craftGoalCompleted = true;
  } },
  { case: '未解决遭遇敌人已死亡', expected: false, mutate: (s) => {
    const npc = Object.values(s.state.characters).find((c) => !c.isPlayer)!;
    npc.alive = false;
    npc.hp = 0;
    npc.diedAtTime = 0;
    s.state.encounter = { enemyId: npc.id, zoneId: s.state.characters[s.state.playerId]!.currentZoneId, startedAtTime: 0, log: [], resolved: false };
  } },
  { case: '未解决遭遇 zoneId 与玩家区域不符', expected: false, mutate: (s) => {
    const npc = Object.values(s.state.characters).find((c) => !c.isPlayer)!;
    const other = Object.values(s.state.zones).find((z) => z.id !== s.state.characters[s.state.playerId]!.currentZoneId)!;
    s.state.encounter = { enemyId: npc.id, zoneId: other.id, startedAtTime: 0, log: [], resolved: false };
  } },
  { case: '对局已结束仍有未解决遭遇', expected: false, mutate: (s) => {
    const npc = Object.values(s.state.characters).find((c) => !c.isPlayer)!;
    s.state.status = 'won';
    s.state.endReason = 'player_won';
    s.state.endedAtTime = s.state.time;
    s.state.encounter = { enemyId: npc.id, zoneId: s.state.characters[s.state.playerId]!.currentZoneId, startedAtTime: 0, log: [], resolved: false };
  } },
  { case: 'pendingPickup zoneId 与玩家区域不符', expected: false, mutate: (s) => {
    const other = Object.values(s.state.zones).find((z) => z.id !== s.state.characters[s.state.playerId]!.currentZoneId)!;
    s.state.pendingPickup = { stack: { uid: 'p1', itemId: 'wood', count: 1 }, source: 'search', zoneId: other.id };
  } },
  { case: 'pendingPickup source 非法', expected: false, mutate: (s) => {
    const p = s.state.characters[s.state.playerId]!;
    s.state.pendingPickup = { stack: { uid: 'p1', itemId: 'wood', count: 1 }, source: 'cheat' as never, zoneId: p.currentZoneId };
  } },

  /* ---- 一致性层（P1-4/8/11） ---- */
  { case: '全局重复 UID（跨角色）', expected: false, mutate: (s) => {
    const p = s.state.characters[s.state.playerId]!;
    const npc = Object.values(s.state.characters).find((c) => !c.isPlayer)!;
    const uid = p.inventory[0]!.uid;
    npc.inventory.push({ uid, itemId: 'wood', count: 1 });
  } },
  { case: '区域存活名单重复 ID', expected: false, mutate: (s) => {
    const p = s.state.characters[s.state.playerId]!;
    const z = s.state.zones[p.currentZoneId]!;
    z.aliveCharacterIds = [...z.aliveCharacterIds, p.id];
  } },
  { case: '存活角色出现在其他区域名单', expected: false, mutate: (s) => {
    const p = s.state.characters[s.state.playerId]!;
    const other = Object.values(s.state.zones).find((z) => z.id !== p.currentZoneId)!;
    other.aliveCharacterIds = [...other.aliveCharacterIds, p.id];
  } },
  { case: 'eventSeq 小于事件 id 最大值', expected: false, mutate: (s) => {
    s.state.eventSeq = 1; // 现存事件 id 是 e0/e1
  } },
  { case: 'eventCounters.total 小于事件数', expected: false, mutate: (s) => {
    s.state.eventCounters.total = 1;
  } },
  { case: 'eventCounters.byType 非法 key', expected: false, mutate: (s) => {
    s.state.eventCounters.byType['HACKED'] = 1;
  } },
  { case: '负 eventCounters.total', expected: false, mutate: (s) => {
    s.state.eventCounters.total = -4;
  } },

  /* ---- 世界事件（Phase 3A Step 6 / Step 8） ---- */
  { case: 'nextWorldEventTime 为负', expected: false, mutate: (s) => { s.state.nextWorldEventTime = -3; } },
  { case: 'activeWorldEvents 非数组', expected: false, mutate: (s) => { (s.state as unknown as Mutable).activeWorldEvents = 'oops'; } },
  { case: 'activeWorldEvents 含非法 eventId', expected: false, mutate: (s) => {
    // 故意塞入非法 eventId，需绕开类型系统以构造损坏存档
    s.state.activeWorldEvents = [
      { id: 'we1', eventId: 'quake', scope: 'global', zoneId: null, startedAtTime: 0, remaining: 3, label: 'X', description: 'X' },
    ] as unknown as typeof s.state.activeWorldEvents;
  } },
  { case: '全局世界事件带 zoneId', expected: false, mutate: (s) => {
    const zid = Object.keys(s.state.zones)[0]!;
    s.state.activeWorldEvents = [
      { id: 'we1', eventId: 'rain', scope: 'global', zoneId: zid, startedAtTime: 0, remaining: 3, label: '雨', description: '雨' },
    ];
  } },
  { case: '区域世界事件指向非法区域', expected: false, mutate: (s) => {
    s.state.activeWorldEvents = [
      { id: 'we1', eventId: 'blackout', scope: 'zone', zoneId: 'no_such_zone', startedAtTime: 0, remaining: 3, label: '停电', description: '停电' },
    ];
  } },
  { case: 'activeWorldEvents remaining=0', expected: false, mutate: (s) => {
    s.state.activeWorldEvents = [
      { id: 'we1', eventId: 'rain', scope: 'global', zoneId: null, startedAtTime: 0, remaining: 0, label: '雨', description: '雨' },
    ];
  } },
  { case: '同一种世界事件重复生效', expected: false, mutate: (s) => {
    s.state.activeWorldEvents = [
      { id: 'we1', eventId: 'rain', scope: 'global', zoneId: null, startedAtTime: 0, remaining: 3, label: '雨', description: '雨' },
      { id: 'we2', eventId: 'rain', scope: 'global', zoneId: null, startedAtTime: 0, remaining: 3, label: '雨', description: '雨' },
    ];
  } },
  { case: 'worldEventHistory 结束早于开始', expected: false, mutate: (s) => {
    s.state.worldEventHistory = [
      { id: 'we1', eventId: 'rain', zoneId: null, startedAtTime: 10, endedAtTime: 5 },
    ];
  } },

  /* ---- 状态效果 / EXPOSED 红线（Phase 3A Step 8） ---- */
  { case: 'statusEffects 含未知状态 id', expected: false, mutate: (s) => {
    const p = s.state.characters[s.state.playerId]!;
    p.statusEffects = [...p.statusEffects, { id: 'panic', remaining: 3, hpPerTick: 0, label: '慌乱' }] as never;
  } },
  { case: 'EXPOSED 带 hpPerTick 伤害（红线）', expected: false, mutate: (s) => {
    const p = s.state.characters[s.state.playerId]!;
    p.statusEffects = [...p.statusEffects, { id: 'exposed', remaining: 3, hpPerTick: -3, label: '露出破绽', damageTakenMult: 1.2 }] as never;
  } },
  { case: 'EXPOSED damageTakenMult 与配置不符', expected: false, mutate: (s) => {
    const p = s.state.characters[s.state.playerId]!;
    p.statusEffects = [...p.statusEffects, { id: 'exposed', remaining: 3, hpPerTick: 0, label: '露出破绽', damageTakenMult: 9.9 }] as never;
  } },
  { case: 'statusEffects 重复 EXPOSED', expected: false, mutate: (s) => {
    const p = s.state.characters[s.state.playerId]!;
    p.statusEffects = [...p.statusEffects, { id: 'exposed', remaining: 3, hpPerTick: 0, label: '露出破绽' }] as never;
    p.statusEffects = [...p.statusEffects, { id: 'exposed', remaining: 2, hpPerTick: 0, label: '露出破绽' }] as never;
  } },

  /* ---- 技能冷却（Phase 3A Step 8） ---- */
  { case: 'skillCooldowns 含未知技能', expected: false, mutate: (s) => {
    const p = s.state.characters[s.state.playerId]!;
    p.skillCooldowns = { ...p.skillCooldowns, fake_skill: 2 };
  } },
  { case: 'skillCooldowns 负值', expected: false, mutate: (s) => {
    const p = s.state.characters[s.state.playerId]!;
    p.skillCooldowns = { ...p.skillCooldowns, adrenaline: -1 };
  } },
];

/* ------------------------------------------------------------------ */
/* 执行与报告                                                          */
/* ------------------------------------------------------------------ */

/** 用例种子：与用例名绑定，保证同一用例每次跑到的都是同一份初始存档 */
function seedForCase(name: string): string {
  return `BR-AUDIT-${name.length}-${name.charCodeAt(0)}`;
}

/**
 * 跑单个损坏用例。
 *
 * P3-P2 的核心：**构造失败不等于「损坏被拒」**。
 * mutate 抛异常意味着这条用例根本没能把存档改坏，`validateSaveData` 也就没被
 * 调用过——此时任何「通过」的结论都是伪造的。所以直接判定失败。
 */
function runCase(c: AuditCase): AuditResult {
  let save: AuditSave;
  try {
    save = makeValidSave(seedForCase(c.case));
  } catch (err) {
    return {
      case: c.case,
      expected: c.expected,
      actual: null,
      passed: false,
      errorMessage: `用例构造失败（基准存档生成异常）：${describeError(err)}`,
      constructionFailed: true,
    };
  }

  try {
    c.mutate(save);
  } catch (err) {
    return {
      case: c.case,
      expected: c.expected,
      actual: null,
      passed: false,
      errorMessage: `用例构造失败（mutate 抛出异常，校验器未被调用）：${describeError(err)}`,
      constructionFailed: true,
    };
  }

  const report = validateSaveData(save);
  return {
    case: c.case,
    expected: c.expected,
    actual: report.ok,
    passed: report.ok === c.expected,
    errorMessage: report.ok ? null : report.errors[0] ?? null,
    constructionFailed: false,
  };
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function runAudit(cases: readonly AuditCase[] = CASES): AuditRun {
  const controlSave = makeValidSave();
  const controlReport = validateSaveData(controlSave);
  const control: AuditResult = {
    case: 'control-valid（正常存档）',
    expected: true,
    actual: controlReport.ok,
    passed: controlReport.ok,
    errorMessage: controlReport.ok ? null : controlReport.errors[0] ?? null,
    constructionFailed: false,
  };

  const results = cases.map(runCase);
  const failed = results.filter((r) => !r.passed);
  const constructionFailures = results.filter((r) => r.constructionFailed);

  return {
    control,
    results,
    failed,
    constructionFailures,
    passed: control.passed && failed.length === 0,
  };
}

/** 把 actual 三态（true / false / null）翻译成人类可读文本 */
function describeActual(actual: boolean | null): string {
  if (actual === null) return '**构造失败（校验器未被调用）**';
  return actual ? '接受' : '拒绝';
}

function renderMarkdown(run: AuditRun): string {
  const { control, results, failed, constructionFailures } = run;
  const L: string[] = [];
  const bar = '#'.repeat(64);
  L.push('# 存档独立验收报告（Phase 3）');
  L.push('');
  L.push(`- 版本：${GAME_VERSION}`);
  L.push(`- 生成时间：${new Date().toISOString()}`);
  L.push(`- 对照组：1 个正常存档`);
  L.push(`- 损坏用例：${results.length} 个`);
  L.push(`- 通过：${results.filter((r) => r.passed).length} / ${results.length}`);
  L.push(`- 构造失败：${constructionFailures.length} 个（P3-P2：任意一个即整轮 FAIL）`);
  L.push('');
  L.push(`- 正常存档被接受：${control.passed ? 'PASS' : 'FAIL'}`);
  L.push('');

  if (constructionFailures.length > 0) {
    L.push('## ⚠ 用例构造失败（审计工具自身缺陷）');
    L.push('');
    L.push('> 这些用例的 `mutate` 抛出了异常，损坏存档根本没被造出来，');
    L.push('> `validateSaveData` 也从未被调用。**不得**把它们记为「通过」。');
    L.push('');
    L.push('| # | 用例 | 异常 |');
    L.push('| --- | --- | --- |');
    constructionFailures.forEach((r, i) => {
      L.push(`| ${i + 1} | ${r.case} | ${r.errorMessage ?? '-'} |`);
    });
    L.push('');
  }

  L.push('## 损坏用例明细');
  L.push('');
  L.push('| # | 用例 | 期望 | 实际 | 通过 | 首个错误 |');
  L.push('| --- | --- | --- | --- | --- | --- |');
  results.forEach((r, i) => {
    L.push(
      `| ${i + 1} | ${r.case} | ${r.expected ? '接受' : '拒绝'} | ${describeActual(r.actual)} | ${r.passed ? '✓' : '✗'} | ${r.errorMessage ?? '-'} |`,
    );
  });
  L.push('');
  L.push(
    `**结论：${run.passed ? 'PASS（全部损坏存档均被拒绝，且无用例构造失败）' : `FAIL（失败 ${failed.length} 项，其中构造失败 ${constructionFailures.length} 项）`}**`,
  );
  L.push('');
  L.push(bar);
  return L.join('\n');
}

function main(): void {
  const run = runAudit();
  const { control, results, failed, constructionFailures } = run;

  const jsonPath = resolve(__dirname, '..', 'reports', 'save-validation-audit.json');
  const mdPath = resolve(__dirname, '..', 'reports', 'save-validation-audit.md');
  mkdirSync(dirname(jsonPath), { recursive: true });

  const report = {
    meta: {
      tool: 'audit-save-validation',
      version: GAME_VERSION,
      generatedAt: new Date().toISOString(),
      control: 'normal-save-accepted',
      totalCases: results.length,
      passedCases: results.filter((r) => r.passed).length,
      failedCases: failed.length,
      constructionFailedCases: constructionFailures.length,
      verdict: run.passed ? 'PASS' : 'FAIL',
    },
    control,
    cases: results,
  };
  writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  writeFileSync(mdPath, renderMarkdown(run), 'utf8');

  // eslint-disable-next-line no-console
  console.log(
    `[audit:save] 对照 ${control.passed ? '通过' : '失败'} | 损坏用例 ${results.length} 个，` +
      `拒绝 ${results.filter((r) => r.actual === false).length} 个，` +
      `通过 ${results.filter((r) => r.passed).length} 个，` +
      `构造失败 ${constructionFailures.length} 个`,
  );
  // eslint-disable-next-line no-console
  console.log(`[audit:save] 报告已写入：\n  ${jsonPath}\n  ${mdPath}`);

  if (!run.passed) {
    for (const r of constructionFailures) {
      // eslint-disable-next-line no-console
      console.error(`[audit:save] FAIL 用例「${r.case}」：${r.errorMessage}`);
    }
    for (const r of failed.filter((x) => !x.constructionFailed)) {
      // eslint-disable-next-line no-console
      console.error(
        `[audit:save] FAIL 用例「${r.case}」：期望 ${r.expected ? '接受' : '拒绝'}，实际 ${r.actual === null ? '构造失败' : r.actual ? '接受' : '拒绝'}`,
      );
    }
    process.exitCode = 1;
  } else {
    // eslint-disable-next-line no-console
    console.log('[audit:save] 判定：PASS');
  }
}

const isMain =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith('auditSaveValidation.ts') ||
    process.argv[1].endsWith('auditSaveValidation.js'));

if (isMain) {
  main();
}

export {
  CASES,
  makeValidSave,
  runAudit,
  runCase,
  renderMarkdown,
  type AuditCase,
  type AuditResult,
  type AuditRun,
  type AuditSave,
};
