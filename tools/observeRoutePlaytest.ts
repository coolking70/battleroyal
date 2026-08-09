/**
 * Phase 4C-7：半自动核心路线观察。
 *
 * 这不是 HUMAN_PLAYTEST_CHECKLIST 的替代品，也不声称是真人试玩。
 * 它用玩家可见的目标建议和正式命令通道，记录 20 条代表性路线的里程碑，
 * 用于区分“路线/策略没有执行到”与“已执行但未观察到材料供给”。
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { CHARACTERS } from '../src/data/characters';
import { ITEMS } from '../src/data/items';
import { RECIPES, tryGetRecipe } from '../src/data/recipes';
import type { GameEvent } from '../src/core/types';
import { runAutoGame, AUTO_PLAYER_POLICIES, type AutoPlayerPolicy } from './autoPlayer';

export interface RoutePlaytestOptions {
  seedPrefix?: string;
  /** 默认 20；用于测试时可传更小的确定性样本。 */
  scenarioCount?: number;
}

export interface RouteMilestoneTimes {
  targetAdopted: number | null;
  firstRawMaterialFound: Record<string, number | null>;
  firstRawMaterialPicked: Record<string, number | null>;
  firstIntermediateCrafted: number | null;
  firstHighTierWeaponCrafted: number | null;
  firstWeaponObtained: number | null;
  firstEquipped: number | null;
  firstEncounter: number | null;
  targetCompleted: number | null;
  death: number | null;
}

export type RouteDiagnosis =
  | 'target-completed'
  | 'equipped-before-encounter'
  | 'encounter-before-equipment'
  | 'weapon-not-converted'
  | 'no-player-material-observed'
  | 'no-target-adopted';

export interface RoutePlaytestRecord {
  runId: string;
  seed: string;
  characterId: string;
  policy: AutoPlayerPolicy;
  outcome: string;
  endReason: string | null;
  timeUsed: number;
  trustworthy: boolean;
  targetRecipeId: string | null;
  targetName: string | null;
  targetOutputItemId: string | null;
  targetOutputName: string | null;
  milestones: RouteMilestoneTimes;
  deathCause: string | null;
  rawMaterialsSeen: string[];
  intermediateOutputsCrafted: string[];
  highTierWeaponsCrafted: string[];
  routeDiagnosis: RouteDiagnosis;
}

export interface RoutePlaytestReport {
  phase: 'Phase 4C-7';
  generatedAt: string;
  evidenceClass: 'SEMI_AUTOMATED_ROUTE_OBSERVATION';
  humanPlaytestStatus: 'NOT_PERFORMED';
  method: {
    requestedRuns: number;
    actualRuns: number;
    matrix: string;
    source: string;
    commandChannel: string;
    hiddenStatePolicy: string;
  };
  health: {
    trustworthyRuns: number;
    requestedEqualsActual: boolean;
    noTimeoutDeadlockIllegalOrHardLimit: boolean;
  };
  milestones: {
    targetAdoptedRuns: number;
    rawMaterialObservedRuns: number;
    intermediateCraftRuns: number;
    weaponObtainedRuns: number;
    equipmentRuns: number;
    encounterRuns: number;
    targetCompletedRuns: number;
    deathRuns: number;
  };
  deathCauses: Record<string, number>;
  diagnosis: Record<RouteDiagnosis, number>;
  records: RoutePlaytestRecord[];
}

const RAW_MATERIAL_IDS = ITEMS
  .filter((item) => item.category === 'material')
  .map((item) => item.id)
  .sort();

const HIGH_TIER_WEAPON_IDS = new Set([
  'field_spear',
  'steel_axe',
  'composite_bow',
  'insulated_pipe',
  'insulated_stun_rod',
]);

const RECIPE_BY_OUTPUT = new Map(RECIPES.map((recipe) => [recipe.outputItemId, recipe]));

function itemName(itemId: string | null): string | null {
  return itemId ? ITEMS.find((item) => item.id === itemId)?.name ?? itemId : null;
}

function eventItemId(event: GameEvent): string | null {
  return typeof event.metadata.itemId === 'string' ? event.metadata.itemId : null;
}

function eventOutputItemId(event: GameEvent): string | null {
  return typeof event.metadata.outputItemId === 'string'
    ? event.metadata.outputItemId
    : null;
}

function firstAt(events: GameEvent[], predicate: (event: GameEvent) => boolean): number | null {
  return events.find(predicate)?.time ?? null;
}

function emptyTimeMap(): Record<string, number | null> {
  return Object.fromEntries(RAW_MATERIAL_IDS.map((itemId) => [itemId, null]));
}

/** 递归取目标的可见依赖成品；只用于本地诊断，不读取当前库存。 */
function dependencyOutputs(recipeId: string | null): Set<string> {
  const result = new Set<string>();
  const visit = (id: string): void => {
    const recipe = tryGetRecipe(id);
    if (!recipe) return;
    for (const ingredient of recipe.ingredients) {
      const child = RECIPE_BY_OUTPUT.get(ingredient.itemId);
      if (!child || result.has(child.outputItemId)) continue;
      result.add(child.outputItemId);
      visit(child.id);
    }
  };
  if (recipeId) visit(recipeId);
  return result;
}

function diagnosisOf(
  milestones: RouteMilestoneTimes,
  targetCompleted: boolean,
): RouteDiagnosis {
  if (targetCompleted || milestones.targetCompleted !== null) return 'target-completed';
  if (milestones.targetAdopted === null) return 'no-target-adopted';
  const rawPicked = Object.values(milestones.firstRawMaterialPicked)
    .some((time) => time !== null);
  if (!rawPicked) return 'no-player-material-observed';
  if (milestones.firstWeaponObtained === null) return 'weapon-not-converted';
  if (milestones.firstEncounter !== null && milestones.firstEquipped === null) {
    return 'encounter-before-equipment';
  }
  if (milestones.firstEquipped !== null &&
      (milestones.firstEncounter === null || milestones.firstEquipped <= milestones.firstEncounter)) {
    return 'equipped-before-encounter';
  }
  return 'weapon-not-converted';
}

function buildRecord(
  index: number,
  seedPrefix: string,
  characterId: string,
  policy: AutoPlayerPolicy,
): RoutePlaytestRecord {
  const seed = `${seedPrefix}-${index}-${characterId}-${policy}`;
  const result = runAutoGame({
    seed,
    characterId,
    policy,
    representativeBuildLoop: true,
    keepFinalState: true,
    keepEventTrace: true,
  });
  const events = (result.eventTrace ?? []).filter(
    (event) => event.actorId === result.finalState?.playerId ||
      (event.type === 'CHARACTER_DIED' && event.targetId === result.finalState?.playerId),
  );
  const playerId = result.finalState?.playerId;
  const targetEvent = events.find(
    (event) => event.type === 'CRAFT_GOAL_SET' &&
      event.metadata.completed === false &&
      event.actorId === playerId,
  );
  const targetRecipeId = typeof targetEvent?.metadata.recipeId === 'string'
    ? targetEvent.metadata.recipeId
    : null;
  const target = targetRecipeId ? tryGetRecipe(targetRecipeId) : null;
  const dependencies = dependencyOutputs(targetRecipeId);

  const firstRawMaterialFound = emptyTimeMap();
  const firstRawMaterialPicked = emptyTimeMap();
  const intermediateOutputsCrafted = new Set<string>();
  const highTierWeaponsCrafted = new Set<string>();
  for (const event of events) {
    const itemId = eventItemId(event);
    if (event.type === 'ITEM_FOUND' && itemId && firstRawMaterialFound[itemId] === null && RAW_MATERIAL_IDS.includes(itemId)) {
      firstRawMaterialFound[itemId] = event.time;
    }
    if (event.type === 'ITEM_PICKED' && itemId && firstRawMaterialPicked[itemId] === null && RAW_MATERIAL_IDS.includes(itemId)) {
      firstRawMaterialPicked[itemId] = event.time;
    }
    if (event.type === 'ITEM_CRAFTED') {
      const outputItemId = eventOutputItemId(event);
      if (outputItemId && dependencies.has(outputItemId)) intermediateOutputsCrafted.add(outputItemId);
      if (outputItemId && HIGH_TIER_WEAPON_IDS.has(outputItemId)) highTierWeaponsCrafted.add(outputItemId);
    }
  }

  const milestones: RouteMilestoneTimes = {
    targetAdopted: targetEvent?.time ?? null,
    firstRawMaterialFound: firstRawMaterialFound,
    firstRawMaterialPicked: firstRawMaterialPicked,
    firstIntermediateCrafted: firstAt(events, (event) => {
      const outputItemId = event.type === 'ITEM_CRAFTED' ? eventOutputItemId(event) : null;
      return outputItemId !== null && dependencies.has(outputItemId);
    }),
    firstHighTierWeaponCrafted: firstAt(events, (event) => {
      const outputItemId = event.type === 'ITEM_CRAFTED' ? eventOutputItemId(event) : null;
      return outputItemId !== null && HIGH_TIER_WEAPON_IDS.has(outputItemId);
    }),
    firstWeaponObtained: firstAt(events, (event) => {
      if (event.type === 'ITEM_PICKED') {
        const pickedItemId = eventItemId(event);
        const item = pickedItemId ? ITEMS.find((candidate) => candidate.id === pickedItemId) : null;
        return item?.category === 'weapon';
      }
      if (event.type === 'ITEM_CRAFTED') {
        const outputItemId = eventOutputItemId(event);
        return Boolean(outputItemId && ITEMS.find((item) => item.id === outputItemId)?.category === 'weapon');
      }
      return false;
    }),
    firstEquipped: firstAt(events, (event) => event.type === 'ITEM_EQUIPPED'),
    firstEncounter: firstAt(events, (event) => event.type === 'ENCOUNTER_STARTED' && event.actorId === playerId),
    targetCompleted: firstAt(events, (event) =>
      event.type === 'CRAFT_GOAL_SET' && event.metadata.completed === true && event.actorId === playerId,
    ),
    death: firstAt(events, (event) => event.type === 'CHARACTER_DIED' && event.targetId === playerId),
  };
  const deathEvent = events.find(
    (event) => event.type === 'CHARACTER_DIED' && event.targetId === playerId,
  );
  const deathCause = typeof deathEvent?.metadata.cause === 'string'
    ? deathEvent.metadata.cause
    : null;

  return {
    runId: `route-${index}-${characterId}-${policy}`,
    seed,
    characterId,
    policy,
    outcome: result.outcome,
    endReason: result.endReason,
    timeUsed: result.timeUsed,
    trustworthy: result.trustworthy && !result.hardLimitReached,
    targetRecipeId,
    targetName: target?.name ?? null,
    targetOutputItemId: target?.outputItemId ?? null,
    targetOutputName: itemName(target?.outputItemId ?? null),
    milestones,
    deathCause,
    rawMaterialsSeen: RAW_MATERIAL_IDS.filter((itemId) => firstRawMaterialPicked[itemId] !== null),
    intermediateOutputsCrafted: [...intermediateOutputsCrafted].sort(),
    highTierWeaponsCrafted: [...highTierWeaponsCrafted].sort(),
    routeDiagnosis: diagnosisOf(milestones, result.craftGoalCompleted),
  };
}

export function collectRoutePlaytest(options: RoutePlaytestOptions = {}): RoutePlaytestReport {
  const seedPrefix = options.seedPrefix ?? 'PHASE4C7-ROUTE';
  const scenarioCount = Math.max(1, Math.min(options.scenarioCount ?? 20, CHARACTERS.length * AUTO_PLAYER_POLICIES.length));
  const scenarios = Array.from({ length: scenarioCount }, (_, index) => ({
    index,
    characterId: CHARACTERS[index % CHARACTERS.length]!.id,
    policy: AUTO_PLAYER_POLICIES[Math.floor(index / CHARACTERS.length) % AUTO_PLAYER_POLICIES.length]!,
  }));
  const records = scenarios.map((scenario) =>
    buildRecord(scenario.index, seedPrefix, scenario.characterId, scenario.policy),
  );
  const requestedRuns = scenarios.length;
  const actualRuns = records.length;
  const count = (predicate: (record: RoutePlaytestRecord) => boolean): number => records.filter(predicate).length;
  const diagnosis = Object.fromEntries(
    (['target-completed', 'equipped-before-encounter', 'encounter-before-equipment', 'weapon-not-converted', 'no-player-material-observed', 'no-target-adopted'] as RouteDiagnosis[])
      .map((key) => [key, count((record) => record.routeDiagnosis === key)]),
  ) as Record<RouteDiagnosis, number>;
  const deathCauses: Record<string, number> = {};
  for (const record of records) {
    if (!record.deathCause) continue;
    deathCauses[record.deathCause] = (deathCauses[record.deathCause] ?? 0) + 1;
  }
  const trustworthyRuns = count((record) => record.trustworthy);

  return {
    phase: 'Phase 4C-7',
    generatedAt: new Date().toISOString(),
    evidenceClass: 'SEMI_AUTOMATED_ROUTE_OBSERVATION',
    humanPlaytestStatus: 'NOT_PERFORMED',
    method: {
      requestedRuns,
      actualRuns,
      matrix: `${new Set(records.map((record) => record.characterId)).size} characters × ${new Set(records.map((record) => record.policy)).size} policies (truncated deterministic matrix)`,
      source: 'tools/autoPlayer.ts representativeBuildLoop via executeCommand',
      commandChannel: 'SET_CRAFT_GOAL / SEARCH / MOVE / CRAFT / EQUIP and other legal commands only',
      hiddenStatePolicy: 'record only player actor milestones; no zone.loot, NPC inventory, NPC location, planner reason or future event data',
    },
    health: {
      trustworthyRuns,
      requestedEqualsActual: requestedRuns === actualRuns,
      noTimeoutDeadlockIllegalOrHardLimit: records.every((record) => record.trustworthy),
    },
    milestones: {
      targetAdoptedRuns: count((record) => record.milestones.targetAdopted !== null),
      rawMaterialObservedRuns: count((record) => record.rawMaterialsSeen.length > 0),
      intermediateCraftRuns: count((record) => record.milestones.firstIntermediateCrafted !== null),
      weaponObtainedRuns: count((record) => record.milestones.firstWeaponObtained !== null),
      equipmentRuns: count((record) => record.milestones.firstEquipped !== null),
      encounterRuns: count((record) => record.milestones.firstEncounter !== null),
      targetCompletedRuns: count((record) => record.milestones.targetCompleted !== null),
      deathRuns: count((record) => record.milestones.death !== null),
    },
    deathCauses,
    diagnosis,
    records,
  };
}

function materialLabel(itemId: string): string {
  return itemName(itemId) ?? itemId;
}

function formatTime(time: number | null): string {
  return time === null ? '—' : String(time);
}

export function markdownForRoutePlaytest(report: RoutePlaytestReport): string {
  const milestone = report.milestones;
  const rows = report.records.map((record) => {
    const raw = record.rawMaterialsSeen.map(materialLabel).join('、') || '未观察到';
    return `| ${record.runId} | ${record.characterId} / ${record.policy} | ${record.targetName ?? '—'} | ${formatTime(record.milestones.targetAdopted)} | ${raw} | ${formatTime(record.milestones.firstIntermediateCrafted)} | ${formatTime(record.milestones.firstWeaponObtained)} | ${formatTime(record.milestones.firstEquipped)} | ${formatTime(record.milestones.firstEncounter)} | ${formatTime(record.milestones.targetCompleted)} | ${record.deathCause ?? '—'} | ${record.routeDiagnosis} |`;
  }).join('\n');
  const diagnosisRows = Object.entries(report.diagnosis)
    .map(([key, value]) => `| ${key} | ${value} |`)
    .join('\n');
  return `# Phase 4C-7 半自动路线观察\n\n` +
    `> 本报告是 \`SEMI_AUTOMATED_ROUTE_OBSERVATION\`。它不是真人试玩，` +
    `没有填写 \`HUMAN_PLAYTEST_CHECKLIST.md\`，也不替代真机/真人判断。\n\n` +
    `## 方法\n\n` +
    `- 矩阵：${report.method.matrix}，请求 ${report.method.requestedRuns} 局，实际 ${report.method.actualRuns} 局。\n` +
    `- 命令闭环：${report.method.commandChannel}。\n` +
    `- 记录边界：${report.method.hiddenStatePolicy}。\n` +
    `- 健康：${report.health.trustworthyRuns}/${report.method.actualRuns} 条路线可信；请求数等于实际数；` +
    `${report.health.noTimeoutDeadlockIllegalOrHardLimit ? '没有超时、死锁、非法命令或硬上限。' : '存在需要追查的健康性异常。'}\n\n` +
    `## 里程碑汇总（观察数据）\n\n` +
    `| 里程碑 | 对局数 |\n| --- | ---: |\n` +
    `| 采纳公开制作目标 | ${milestone.targetAdoptedRuns} |\n` +
    `| 观察到玩家拾取原材料 | ${milestone.rawMaterialObservedRuns} |\n` +
    `| 完成目标依赖中的中间步骤 | ${milestone.intermediateCraftRuns} |\n` +
    `| 获得任一武器 | ${milestone.weaponObtainedRuns} |\n` +
    `| 发生装备事件 | ${milestone.equipmentRuns} |\n` +
    `| 首次进入遭遇 | ${milestone.encounterRuns} |\n` +
    `| 完成当前制作目标 | ${milestone.targetCompletedRuns} |\n` +
    `| 玩家死亡 | ${milestone.deathRuns} |\n\n` +
    `死亡原因：${Object.entries(report.deathCauses).map(([cause, count]) => `${cause} ${count}`).join('、') || '无'}。\n\n` +
    `## 路线诊断分类\n\n| 分类 | 对局数 |\n| --- | ---: |\n${diagnosisRows}\n\n` +
    `分类只说明观察到的里程碑顺序，不等同于经济平衡结论；“未观察到”也不证明区域库存为空。\n\n` +
    `## 逐路线时间\n\n` +
    `| 路线 | 角色 / 策略 | 目标 | 目标采纳 | 原材料（已拾取） | 中间步骤首个 | 武器首个 | 装备首个 | 遭遇首个 | 目标完成 | 死亡原因 | 诊断 |\n` +
    `| --- | --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |\n${rows}\n\n` +
    `## 结论与下一步\n\n` +
    `本记录器用于回答“玩家式闭环能否被完整执行”，不是用来调胜率。只有在半自动路线和真人路线都显示某条固定路径在合理时间内稳定不可达时，才考虑最小的数据层供给调整。当前真人触控、首次上手理解、屏幕阅读器和长局取舍仍标记为 \`HUMAN-PLAYTEST-NEEDED\`。\n`;
}

export function writeRoutePlaytestReports(
  report: RoutePlaytestReport,
  jsonPath = 'reports/phase4c7-route-playtest.json',
  markdownPath = 'reports/phase4c7-route-playtest.md',
): void {
  const jsonOutput = resolve(process.cwd(), jsonPath);
  const markdownOutput = resolve(process.cwd(), markdownPath);
  mkdirSync(dirname(jsonOutput), { recursive: true });
  mkdirSync(dirname(markdownOutput), { recursive: true });
  writeFileSync(jsonOutput, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(markdownOutput, markdownForRoutePlaytest(report), 'utf8');
  console.log(`Wrote ${jsonOutput}`);
  console.log(`Wrote ${markdownOutput}`);
}

if (process.argv[1]?.endsWith('observeRoutePlaytest.ts')) {
  const report = collectRoutePlaytest({
    seedPrefix: process.env.PHASE4C7_ROUTE_SEED_PREFIX ?? 'PHASE4C7-ROUTE',
  });
  writeRoutePlaytestReports(report);
}
