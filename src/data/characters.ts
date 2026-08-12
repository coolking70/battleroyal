import type { CharacterDef } from '../core/types';

/**
 * 8 名可选角色模板。角色身份、属性、被动与技能映射均由数据注册表承载。
 * 新角色使用既有主动技能通道，不另起一套职业规则。
 */
export const CHARACTERS: CharacterDef[] = [
  {
    id: 'scout',
    name: '侦察员',
    description:
      '习惯在陌生环境里先看清楚再动手。感知突出，很少空手而归，也更早察觉危险。',
    maxHp: 95,
    maxStamina: 110,
    attack: 8,
    defense: 4,
    perception: 9,
    speed: 8,
    crafting: 4,
    medical: 3,
    passiveId: 'keen_eye',
    passiveName: '锐目',
    passiveDescription: '搜索空手而归的概率减半，且更容易先发现同区域的敌人。',
  },
  {
    id: 'fighter',
    name: '斗士',
    description:
      '正面冲突不吃亏的类型。生命与近战伤害都高，但跑不快，也不擅长脱身。',
    maxHp: 105,
    maxStamina: 100,
    attack: 8,
    defense: 5,
    perception: 4,
    speed: 5,
    crafting: 3,
    medical: 2,
    passiveId: 'brawler',
    passiveName: '搏击',
    passiveDescription: '近战武器额外造成 2 点伤害，但逃跑成功率降低 15%。',
  },
  {
    id: 'engineer',
    name: '工程师',
    description:
      '手上功夫比拳头强。合成消耗更少，找材料更有心得，但初始攻击偏低。',
    maxHp: 100,
    maxStamina: 105,
    attack: 7,
    defense: 5,
    perception: 6,
    speed: 6,
    crafting: 9,
    medical: 3,
    passiveId: 'tinkerer',
    passiveName: '巧手',
    passiveDescription: '合成只消耗 1 点体力，搜索时更容易翻出制作材料。',
  },
  {
    id: 'medic',
    name: '医学生',
    description:
      '还没毕业就被丢进这里。治疗效果显著，在医院如鱼得水，但防御很薄。',
    maxHp: 100,
    maxStamina: 100,
    attack: 5,
    defense: 3,
    perception: 6,
    speed: 6,
    crafting: 4,
    medical: 9,
    passiveId: 'field_medic',
    passiveName: '临床',
    passiveDescription: '消耗品治疗量提高 50%，在医院搜索有额外收获加成。',
  },
  {
    id: 'survivor',
    name: '生存专家',
    description:
      '懂得把每一次休息都变成下一段路程的储备。体力与禁区耐受更稳，但不擅长快速搜集或正面决斗。',
    maxHp: 105,
    maxStamina: 115,
    attack: 6,
    defense: 6,
    perception: 5,
    speed: 6,
    crafting: 3,
    medical: 4,
    passiveId: 'enduring',
    passiveName: '耐性',
    passiveDescription: '休息额外恢复体力，且禁区侵蚀伤害降低 20%。',
  },
  {
    id: 'scavenger',
    name: '拾荒者',
    description:
      '不靠运气赌装备，而是从有限物资里挑出真正有用的零件。搜索路线与材料管理是它的强项。',
    maxHp: 98,
    maxStamina: 105,
    attack: 6,
    defense: 4,
    perception: 8,
    speed: 7,
    crafting: 7,
    medical: 3,
    passiveId: 'resourceful',
    passiveName: '资源嗅觉',
    passiveDescription: '更容易发现物品并偏向材料；不会改变区域有限库存或凭空生成物品。',
  },
  {
    id: 'hunter',
    name: '猎人',
    description:
      '把已经掌握的线索转化成接敌优势。擅长追踪与远程命中，但必须先建立情报，不能透视全图。',
    maxHp: 98,
    maxStamina: 105,
    attack: 8,
    defense: 4,
    perception: 8,
    speed: 9,
    crafting: 3,
    medical: 2,
    passiveId: 'tracker',
    passiveName: '追猎',
    passiveDescription: '对已知目标的远程攻击命中机会提高，不公开远端角色位置。',
  },
  {
    id: 'trapper',
    name: '陷阱师',
    description:
      '用提前布置换取接敌主动权。防御、反击与撤退准备更有价值，但移动和持续搜索能力一般。',
    maxHp: 102,
    maxStamina: 100,
    attack: 6,
    defense: 8,
    perception: 5,
    speed: 5,
    crafting: 5,
    medical: 3,
    passiveId: 'trapsetter',
    passiveName: '预设反制',
    passiveDescription: '处于防御姿态时反击概率提高，鼓励先布置再接敌。',
  },
];

const CHARACTER_MAP: Record<string, CharacterDef> = Object.fromEntries(
  CHARACTERS.map((c) => [c.id, c]),
);

export function getCharacterDef(id: string): CharacterDef {
  const def = CHARACTER_MAP[id];
  if (!def) {
    throw new Error(`未知角色 id: ${id}`);
  }
  return def;
}

export function tryGetCharacterDef(id: string): CharacterDef | null {
  return CHARACTER_MAP[id] ?? null;
}

/** NPC 姓名池：保证同一局内姓名不重复 */
export const NPC_NAME_POOL: string[] = [
  '灰隼',
  '铁砂',
  '夜枭',
  '白杨',
  '青苔',
  '断线',
  '铜环',
  '短波',
  '碎瓦',
  '寒星',
  '钝角',
  '蓝雀',
];
