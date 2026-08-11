/* ------------------------------------------------------------------ */
/* 物品                                                                */
/* ------------------------------------------------------------------ */

export type ItemCategory = 'material' | 'weapon' | 'armor' | 'consumable';

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
  /* 武器 */
  weaponType?: WeaponType;
  attack?: number;
  durability?: number;
  /* 防具 */
  defense?: number;
  /* 消耗品 */
  healHp?: number;
  healStamina?: number;
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
