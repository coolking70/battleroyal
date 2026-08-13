/* ------------------------------------------------------------------ */
/* 物品                                                                */
/* ------------------------------------------------------------------ */

export type ItemCategory =
  | 'material'
  | 'component'
  | 'weapon'
  | 'armor'
  | 'consumable'
  | 'utility';

/** 制作图谱中的固定层级；不从区域掉落或物品名称推断。 */
export type CraftTier = 'raw' | 'component' | 'final';

export type EquipmentSlot = 'weapon' | 'armor' | 'utility';

export type WeaponFamily =
  | 'blunt'
  | 'blade'
  | 'heavy'
  | 'bow'
  | 'improvised_ranged'
  | 'electric_special';

export type ArmorClass = 'light' | 'medium' | 'heavy';

/** 第一版只区分近战 / 远程，远程不实现弹道，仅在数值与日志上体现 */
export type WeaponType = 'melee' | 'ranged';

export interface ItemDef {
  id: string;
  name: string;
  category: ItemCategory;
  description: string;
  /** 价值评分：用于 NPC 取舍、尸体掉落排序、结算展示 */
  value: number;
  stackable: boolean;
  maxStack: number;
  /** raw / component / final 的固定制作角色。 */
  craftTier: CraftTier;
  /** 只有最终装备可进入装备槽；组件即使带 attack 也不可装备。 */
  equipmentSlot?: EquipmentSlot;
  /* 武器 */
  weaponType?: WeaponType;
  weaponFamily?: WeaponFamily;
  attack?: number;
  durability?: number;
  /* 防具 */
  defense?: number;
  armorClass?: ArmorClass;
  /* 消耗品 */
  healHp?: number;
  healStamina?: number;
  /* utility 装备的固定、轻量被动；不改变背包容量或体力免费契约。 */
  searchFindMult?: number;
}

/** 背包 / 地面上的一个物品实例 */
export interface ItemStack {
  /** 实例唯一 ID，用于精确定位某一格 */
  uid: string;
  itemId: string;
  count: number;
  /** 武器当前耐久，非武器为 undefined */
  durability?: number;
  droppedBy?: string; revealedTo?: string[]; // 尸体掉落归属，见 legalActions.canAccessGroundItem
}
