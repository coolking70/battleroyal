/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearInventory, give, newGame, player } from './helpers';
import { RECIPES } from '../src/data/recipes';
import { GameScreen } from '../src/ui/screens/GameScreen';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('Phase 4E-1 改进 B：可合成提示（UI）', () => {
  it('新获得物品后出现可合成提示，并可一键合成（走既有 CRAFT 通道）', () => {
    // 首帧：空背包（基线，不应出现提示）
    const stateA = newGame('E1-HINT-UI');
    const pA = player(stateA);
    clearInventory(pA);
    const dispatch = vi.fn();
    act(() => {
      root.render(<GameScreen state={stateA} player={pA} dispatch={dispatch} onQuit={() => undefined} />);
    });
    expect(container.querySelector('.craftable-hint')).toBeNull();

    // 第二帧：获得某配方材料 → 提示出现
    const stateB = newGame('E1-HINT-UI');
    const pB = player(stateB);
    clearInventory(pB);
    const R = RECIPES[0]!;
    for (const ing of R.ingredients) give(stateB, pB, ing.itemId, ing.count);
    act(() => {
      root.render(<GameScreen state={stateB} player={pB} dispatch={dispatch} onQuit={() => undefined} />);
    });

    const hint = container.querySelector('.craftable-hint');
    expect(hint).not.toBeNull();
    expect(hint!.textContent).toContain('可合成');

    const craftBtn = container.querySelector('[data-craftable-hint-craft="true"]') as HTMLButtonElement;
    act(() => craftBtn.click());
    expect(dispatch).toHaveBeenCalled();
    const call = dispatch.mock.calls[0]![0] as { type: string; recipeId?: string };
    expect(call.type).toBe('CRAFT');
    expect(RECIPES.some((r) => r.id === call.recipeId)).toBe(true);
  });

  it('提示可忽略关闭，非常驻占位', () => {
    const stateA = newGame('E1-HINT-DISMISS');
    const pA = player(stateA);
    clearInventory(pA);
    const dispatch = vi.fn();
    act(() => {
      root.render(<GameScreen state={stateA} player={pA} dispatch={dispatch} onQuit={() => undefined} />);
    });

    const stateB = newGame('E1-HINT-DISMISS');
    const pB = player(stateB);
    clearInventory(pB);
    const R = RECIPES[0]!;
    for (const ing of R.ingredients) give(stateB, pB, ing.itemId, ing.count);
    act(() => {
      root.render(<GameScreen state={stateB} player={pB} dispatch={dispatch} onQuit={() => undefined} />);
    });
    expect(container.querySelector('.craftable-hint')).not.toBeNull();

    const dismiss = container.querySelector('[data-craftable-hint-dismiss="true"]') as HTMLButtonElement;
    act(() => dismiss.click());
    expect(container.querySelector('.craftable-hint')).toBeNull();
  });
});
