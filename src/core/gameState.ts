import { CHARACTERS, NPC_NAME_POOL, getCharacterDef } from '../data/characters';
import { GAME_CONFIG, GAME_VERSION } from '../data/gameConfig';
import { MATERIAL_IDS } from '../data/items';
import { LEGACY_ZONE_IDS, ZONES, ZONE_IDS } from '../data/zones';
import { pushEvent } from './events';
import { refreshPlayerSight } from './info';
import { addItem, createStack } from './inventory';
import { SeededRandom } from './random';
import { generateZoneLoot, initZoneLoot } from './zoneLoot';
import type {
  Combatant,
  GameState,
  Personality,
  ZoneState,
} from './types';

/** 5 名 NPC 各分配一种人格，保证一局内五种人格都出现 */
const PERSONALITIES: Personality[] = [
  'aggressive',
  'cautious',
  'collector',
  'opportunist',
  'random',
];

/** 新游戏的 player / NPC 出生统一从当前完整固定地图候选池抽取。 */
export const SPAWN_ZONE_IDS: readonly string[] = ZONE_IDS;

export function pickSpawnZone(rng: SeededRandom): string {
  return rng.pick(SPAWN_ZONE_IDS) ?? SPAWN_ZONE_IDS[0] ?? 'school';
}

export const PERSONALITY_LABEL: Record<Personality, string> = {
  aggressive: '激进',
  cautious: '谨慎',
  collector: '收集',
  opportunist: '投机',
  random: '随机',
};

function createZoneState(id: string): ZoneState {
  return {
    id,
    status: 'safe',
    searchCount: 0,
    supply: 1,
    loot: [],
    initialLootCount: 0,
    remainingLootCount: 0,
    searchedEmptyCount: 0,
    warningAtTime: null,
    restrictedAtTime: null,
    groundItems: [],
    aliveCharacterIds: [],
    lastCombatTime: -1,
    lastNoiseTime: -1,
    noiseLevel: 0,
  };
}

function createCombatant(params: {
  id: string;
  name: string;
  isPlayer: boolean;
  characterId: string;
  personality: Personality;
  zoneId: string;
}): Combatant {
  const def = getCharacterDef(params.characterId);
  return {
    id: params.id,
    name: params.name,
    isPlayer: params.isPlayer,
    characterId: def.id,
    personality: params.personality,
    level: 1,
    exp: 0,
    hp: def.maxHp,
    maxHp: def.maxHp,
    stamina: def.maxStamina,
    maxStamina: def.maxStamina,
    attack: def.attack,
    defense: def.defense,
    perception: def.perception,
    speed: def.speed,
    crafting: def.crafting,
    medical: def.medical,
    passiveId: def.passiveId,
    currentZoneId: params.zoneId,
    inventory: [],
    equipment: [],
    equippedWeaponId: null,
    equippedArmorId: null,
    alive: true,
    kills: 0,
    statusEffects: [],
    guarding: false,
    skillCooldowns: {},
    lastAction: null,
    lastActionReason: null,
    knownEnemies: [],
    killedBy: null,
    diedAtTime: null,
    stats: {
      searches: 0,
      crafts: 0,
      moves: 0,
      itemsUsed: 0,
      attacks: 0,
      damageDealt: 0,
      damageTaken: 0,
    },
    plannedRecipeId: null,
    planCreatedAt: null,
    planReason: null,
    planProgress: 0,
    planNoProgressTurns: 0,
    planRecommendedZoneId: null,
    lastReplanReason: null,
    furthestPhase: 'opening',
  };
}

/** 按角色模板发放初始物品 */
function grantStartingItems(state: GameState, c: Combatant, rng: SeededRandom): void {
  addItem(c, createStack(state, 'water', 1));

  const materialId = rng.pick(MATERIAL_IDS) ?? 'wood';
  addItem(c, createStack(state, materialId, 1));

  if (c.characterId === 'medic') {
    addItem(c, createStack(state, 'bandage', 1));
  }
}

export interface CreateGameOptions {
  seed: string;
  playerCharacterId: string;
  playerName?: string;
}

/**
 * 创建一局新游戏。
 * 全部随机来源均取自种子 RNG，因此同种子 + 同角色 = 同开局。
 */
export function createGame(options: CreateGameOptions): GameState {
  const rng = new SeededRandom(options.seed);
  // 旧角色的正式回放与历史模拟继续使用原四职业 NPC 池，避免扩张职业表
  // 改变既有种子的 RNG/遭遇基线；以新职业开局时，NPC 使用完整注册表，
  // 从而让每个 Phase 4L 职业都能在真实对局中作为 NPC 出现。
  const legacyCharacterIds = new Set(['scout', 'fighter', 'engineer', 'medic']);
  const npcTemplates = CHARACTERS.filter(
    (character) =>
      !legacyCharacterIds.has(options.playerCharacterId) || legacyCharacterIds.has(character.id),
  );

  const state: GameState = {
    version: GAME_VERSION,
    seed: options.seed,
    rngState: rng.getState(),
    time: 0,
    status: 'playing',
    playerId: 'p0',
    turnOrder: [],
    characters: {},
    zones: {},
    events: [],
    eventSeq: 0,
    uidSeq: 0,
    encounter: null,
    pendingPickup: null,
    engagedWithPlayer: [],
    nextZoneEventTime: GAME_CONFIG.firstZoneEventTime,
    nextWorldEventTime: GAME_CONFIG.firstWorldEventTime,
    activeWorldEvents: [],
    worldEventHistory: [],
    deathOrder: [],
    stats: {
      searches: 0,
      crafts: 0,
      moves: 0,
      itemsUsed: 0,
      attacks: 0,
      zonesExhausted: 0,
      noiseDecayBlockedTicks: 0,
    },
    endedAtTime: null,
    phase: 'opening',
    finaleStartedAt: null,
    craftGoalRecipeId: null,
    craftGoalCompleted: false,
    eventCounters: { total: 0, archived: 0, byType: {} },
    playerIntel: {},
    endReason: null,
  };

  const legacyZoneIds = new Set<string>(LEGACY_ZONE_IDS);
  for (const z of ZONES) {
    const zone = createZoneState(z.id);
    // 有限物资：开局一次性生成，之后只减不增
    // 保持旧六区的主 RNG 序列不变；新增区域使用派生 RNG，避免内容扩张
    // 改变旧种子的出生、搜索和 NPC 行为，同时仍然保证新区库存确定性。
    const lootRng = legacyZoneIds.has(z.id)
      ? rng
      : new SeededRandom(`phase4k:${options.seed}:${z.id}`);
    initZoneLoot(zone, generateZoneLoot(z.id, lootRng));
    state.zones[z.id] = zone;
  }

  // --- 玩家 ---
  const playerZone = pickSpawnZone(rng);
  const player = createCombatant({
    id: 'p0',
    name: options.playerName?.trim() || '你',
    isPlayer: true,
    characterId: options.playerCharacterId,
    personality: 'random',
    zoneId: playerZone,
  });
  state.characters[player.id] = player;
  state.turnOrder.push(player.id);

  // --- NPC ---
  const names = rng.shuffle(NPC_NAME_POOL).slice(0, GAME_CONFIG.npcCount);
  const personalities = rng.shuffle(PERSONALITIES);
  for (let i = 0; i < GAME_CONFIG.npcCount; i++) {
    const template = rng.pick(npcTemplates);
    const npc = createCombatant({
      id: `n${i + 1}`,
      name: names[i] ?? `参赛者${i + 1}`,
      isPlayer: false,
      characterId: template ? template.id : 'scout',
      personality: personalities[i] ?? 'random',
      zoneId: pickSpawnZone(rng),
    });
    state.characters[npc.id] = npc;
    state.turnOrder.push(npc.id);
  }

  // --- 初始物品 ---
  for (const id of state.turnOrder) {
    const c = state.characters[id];
    if (c) grantStartingItems(state, c, rng);
  }

  refreshZoneOccupants(state);
  refreshPlayerSight(state);
  state.rngState = rng.getState();

  pushEvent(state, {
    type: 'GAME_STARTED',
    message: `对局开始。共 ${state.turnOrder.length} 名参赛者进入禁区，种子 ${state.seed}。`,
    metadata: { seed: state.seed, contestants: state.turnOrder.length },
  });
  pushEvent(state, {
    type: 'GAME_STARTED',
    actorId: player.id,
    zoneId: player.currentZoneId,
    message: `你以「${getCharacterDef(player.characterId).name}」身份，从 ${
      ZONES.find((z) => z.id === player.currentZoneId)?.name ?? player.currentZoneId
    } 开始。`,
    metadata: { characterId: player.characterId },
  });

  return state;
}

/* ------------------------------------------------------------------ */
/* 选择器 / 派生数据                                                    */
/* ------------------------------------------------------------------ */

export function getPlayer(state: GameState): Combatant {
  const p = state.characters[state.playerId];
  if (!p) throw new Error('游戏状态损坏：找不到玩家角色');
  return p;
}

export function getCharacter(state: GameState, id: string): Combatant | null {
  return state.characters[id] ?? null;
}

export function allCharacters(state: GameState): Combatant[] {
  return state.turnOrder
    .map((id) => state.characters[id])
    .filter((c): c is Combatant => Boolean(c));
}

export function aliveCharacters(state: GameState): Combatant[] {
  return allCharacters(state).filter((c) => c.alive);
}

export function charactersInZone(state: GameState, zoneId: string): Combatant[] {
  return aliveCharacters(state).filter((c) => c.currentZoneId === zoneId);
}

/** 同区域的其他存活角色 */
export function enemiesInZone(state: GameState, self: Combatant): Combatant[] {
  return charactersInZone(state, self.currentZoneId).filter((c) => c.id !== self.id);
}

/** 重新计算每个区域的存活角色列表（每个时间单位与每次移动后调用） */
export function refreshZoneOccupants(state: GameState): void {
  for (const zoneId of ZONE_IDS) {
    const zone = state.zones[zoneId];
    if (zone) zone.aliveCharacterIds = [];
  }
  for (const c of allCharacters(state)) {
    if (!c.alive) continue;
    const zone = state.zones[c.currentZoneId];
    if (zone) zone.aliveCharacterIds.push(c.id);
  }
}

/** 深拷贝游戏状态。命令执行前调用，保证外部拿到的是全新对象（React 友好） */
export function cloneState(state: GameState): GameState {
  return structuredClone(state);
}
