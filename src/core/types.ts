/**
 * 核心类型兼容出口。
 * 具体声明按物品、角色、区域、配方、事件、遭遇与游戏状态拆分，
 * 保留既有 `from './types'` / `from '../core/types'` 引用路径。
 */

export * from './types/sharedTypes';
export * from './types/itemTypes';
export * from './types/characterTypes';
export * from './types/zoneTypes';
export * from './types/recipeTypes';
export * from './types/eventTypes';
export * from './types/encounterTypes';
export * from './types/wildTypes';
export * from './types/gameTypes';
export * from './types/victoryTypes';
export * from './commandTypes';
