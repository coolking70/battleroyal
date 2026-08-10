/**
 * Phase 4E-1 改进 C：点击生命 / 体力槽的四条判定分支（§3 写死规则）。
 *
 * 直接测纯函数 `decideQuickRestore` 与 `quickRestoreCandidates`：
 * 1. 候选集：只取所点击槽恢复量 > 0 的物品；
 * 2. 唯一候选且不溢出 → 自动使用（auto）；
 * 3. 多候选 / 唯一候选会溢出 / 候选为空 → 选择窗（choose）；
 * 4. 双效物品（草药 / 能量饮料）自动与否只看所点击槽，另一项溢出不排斥。
 */

import { describe, expect, it } from 'vitest';
import { clearInventory, give, newGame, player } from './helpers';
import { decideQuickRestore, quickRestoreCandidates } from '../src/ui/quickRestore';

describe('Phase 4E-1 改进 C：快捷恢复判定', () => {
  it('§3.1 候选集只含所点击槽恢复量 > 0 的物品', () => {
    const state = newGame('E1-QR-CAND');
    const p = player(state);
    clearInventory(p);
    // bandage 只回血；water 只回体力；herb 双效
    give(state, p, 'bandage', 1);
    give(state, p, 'water', 1);
    give(state, p, 'herb_remedy', 1);

    const hpCandidates = quickRestoreCandidates(p, 'hp');
    const staminaCandidates = quickRestoreCandidates(p, 'stamina');

    expect(hpCandidates.map((c) => c.itemId).sort()).toEqual(['bandage', 'herb_remedy'].sort());
    expect(staminaCandidates.map((c) => c.itemId).sort()).toEqual(['herb_remedy', 'water'].sort());
  });

  it('§3.2 唯一候选且不溢出 → 自动使用', () => {
    const state = newGame('E1-QR-AUTO');
    const p = player(state);
    clearInventory(p);
    p.hp = Math.max(1, p.maxHp - 20); // 空缺 ≥ 15
    give(state, p, 'bandage', 1); // healHp 15

    const decision = decideQuickRestore(p, 'hp');
    expect(decision.mode).toBe('auto');
    expect(decision.autoUid).toBe(p.inventory[0]!.uid);
  });

  it('§3.3 唯一候选但会溢出 → 选择窗', () => {
    const state = newGame('E1-QR-OVERFLOW');
    const p = player(state);
    clearInventory(p);
    p.hp = p.maxHp; // 空缺 0
    give(state, p, 'bandage', 1); // healHp 15 > 0 → 溢出

    const decision = decideQuickRestore(p, 'hp');
    expect(decision.mode).toBe('choose');
  });

  it('§3.3 多候选 → 选择窗', () => {
    const state = newGame('E1-QR-MULTI');
    const p = player(state);
    clearInventory(p);
    p.hp = Math.max(1, p.maxHp - 20);
    give(state, p, 'bandage', 1);
    give(state, p, 'medkit', 1);

    const decision = decideQuickRestore(p, 'hp');
    expect(decision.mode).toBe('choose');
  });

  it('§3.2 同种物品占多个堆叠仍算"一种" → 仍自动使用', () => {
    const state = newGame('E1-QR-STACKS');
    const p = player(state);
    clearInventory(p);
    p.hp = 1; // 空缺足够大
    give(state, p, 'bandage', 4); // maxStack 3 → 拆成 2 个堆叠
    expect(p.inventory.length).toBeGreaterThan(1);

    const candidates = quickRestoreCandidates(p, 'hp');
    expect(candidates.length).toBe(1); // 按种类聚合
    expect(candidates[0]!.count).toBe(4);

    const decision = decideQuickRestore(p, 'hp');
    expect(decision.mode).toBe('auto');
    expect(decision.autoUid).toBe(p.inventory[0]!.uid);
  });

  it('§3.3 候选为空 → 选择窗（由 UI 给出说明）', () => {
    const state = newGame('E1-QR-EMPTY');
    const p = player(state);
    clearInventory(p);

    const decision = decideQuickRestore(p, 'hp');
    expect(decision.mode).toBe('choose');
    expect(quickRestoreCandidates(p, 'hp').length).toBe(0);
  });

  it('§3.4 双效物品：点生命只看 healHp，不因体力溢出被排除', () => {
    const state = newGame('E1-QR-DUAL-HP');
    const p = player(state);
    clearInventory(p);
    p.hp = Math.max(1, p.maxHp - 20); // 空缺 ≥ 10
    p.stamina = p.maxStamina; // 体力已满（草药回体力会溢出，但不应影响生命自动）
    give(state, p, 'herb_remedy', 1); // healHp 10 / healStamina 10

    const decision = decideQuickRestore(p, 'hp');
    expect(decision.mode).toBe('auto');
    expect(decision.autoUid).toBe(p.inventory[0]!.uid);
  });

  it('§3.4 双效物品：点体力只看 healStamina', () => {
    const state = newGame('E1-QR-DUAL-STA');
    const p = player(state);
    clearInventory(p);
    p.stamina = Math.max(1, p.maxStamina - 20); // 空缺 ≥ 10
    give(state, p, 'herb_remedy', 1);

    const decision = decideQuickRestore(p, 'stamina');
    expect(decision.mode).toBe('auto');
  });

  it('§3.4 双效物品在所点击槽溢出 → 选择窗', () => {
    const state = newGame('E1-QR-DUAL-OVER');
    const p = player(state);
    clearInventory(p);
    p.hp = p.maxHp; // 生命已满
    give(state, p, 'herb_remedy', 1);

    const decision = decideQuickRestore(p, 'hp');
    expect(decision.mode).toBe('choose');
  });
});
