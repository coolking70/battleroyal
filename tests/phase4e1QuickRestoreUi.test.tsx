/** @vitest-environment jsdom */

import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearInventory, give, newGame, player } from './helpers';
import { StatusBar } from '../src/ui/components/StatusBar';
import { QuickRestoreMenu } from '../src/ui/components/QuickRestoreMenu';
import type { RestoreSlot } from '../src/ui/quickRestore';

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

function renderStatusBar(state: ReturnType<typeof newGame>, p: ReturnType<typeof player>, onUseItem: (uid: string) => void): void {
  act(() => {
    root.render(<StatusBar state={state} player={p} aliveCount={5} onQuit={() => undefined} onUseItem={onUseItem} />);
  });
}

describe('Phase 4E-1 §3 快捷恢复（UI）', () => {
  it('生命 / 体力槽是真正的按钮且有无障碍标签，[title] 仍为 0', () => {
    const state = newGame('E1-UI-BTN');
    const p = player(state);
    renderStatusBar(state, p, () => undefined);

    const buttons = container.querySelectorAll('.bar-button');
    expect(buttons.length).toBe(2);
    const hp = buttons[0] as HTMLButtonElement;
    expect(hp.tagName).toBe('BUTTON');
    expect(hp.getAttribute('aria-label')).toContain('生命');
    // §6 无障碍：全站 [title] 保持为 0
    expect(container.querySelectorAll('[title]').length).toBe(0);
  });

  it('唯一候选且不溢出 → 点击直接自动使用，不弹窗（§3.2）', () => {
    const state = newGame('E1-UI-AUTO');
    const p = player(state);
    clearInventory(p);
    p.hp = Math.max(1, p.maxHp - 20);
    give(state, p, 'bandage', 1);
    const onUseItem = vi.fn();
    renderStatusBar(state, p, onUseItem);

    const hp = container.querySelector('.survival-metric-hp .bar-button') as HTMLButtonElement;
    act(() => hp.click());
    expect(onUseItem).toHaveBeenCalledWith(p.inventory[0]!.uid);
    expect(container.querySelector('.quick-restore-menu')).toBeNull();
  });

  it('多候选 → 弹出选择窗，点击条目使用（§3.3）', () => {
    const state = newGame('E1-UI-CHOOSE');
    const p = player(state);
    clearInventory(p);
    p.hp = Math.max(1, p.maxHp - 20);
    give(state, p, 'bandage', 1);
    give(state, p, 'medkit', 1);
    const onUseItem = vi.fn();
    renderStatusBar(state, p, onUseItem);

    const hp = container.querySelector('.survival-metric-hp .bar-button') as HTMLButtonElement;
    act(() => hp.click());
    const menu = container.querySelector('.quick-restore-menu');
    expect(menu).not.toBeNull();
    expect(container.querySelectorAll('.quick-restore-item').length).toBe(2);
    expect(onUseItem).not.toHaveBeenCalled();
    act(() => (container.querySelectorAll('.quick-restore-item')[0] as HTMLButtonElement).click());
    expect(onUseItem).toHaveBeenCalledTimes(1);
    // 用掉一件后选择窗收起，焦点归还触发槽（不留悬空焦点）
    expect(container.querySelector('.quick-restore-menu')).toBeNull();
    expect(document.activeElement).toBe(hp);
  });

  it('关闭按钮收起选择窗（§3.3）', () => {
    const state = newGame('E1-UI-CLOSE');
    const p = player(state);
    clearInventory(p);
    p.hp = Math.max(1, p.maxHp - 20);
    give(state, p, 'bandage', 1);
    give(state, p, 'medkit', 1);
    const onUseItem = vi.fn();
    renderStatusBar(state, p, onUseItem);

    const hp = container.querySelector('.survival-metric-hp .bar-button') as HTMLButtonElement;
    act(() => hp.click());
    expect(container.querySelector('.quick-restore-menu')).not.toBeNull();
    act(() => (container.querySelector('.quick-restore-close') as HTMLButtonElement).click());
    expect(container.querySelector('.quick-restore-menu')).toBeNull();
    expect(document.activeElement).toBe(hp);
  });

  it('Esc 关闭选择窗（§3.3 复用 useDrawerFocus）', () => {
    const state = newGame('E1-UI-ESC');
    const p = player(state);
    clearInventory(p);
    p.hp = Math.max(1, p.maxHp - 20);
    give(state, p, 'bandage', 1);
    give(state, p, 'medkit', 1);
    renderStatusBar(state, p, vi.fn());

    const hp = container.querySelector('.survival-metric-hp .bar-button') as HTMLButtonElement;
    act(() => hp.click());
    expect(container.querySelector('.quick-restore-menu')).not.toBeNull();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(container.querySelector('.quick-restore-menu')).toBeNull();
  });

  it('候选为空 → 选择窗给出明确说明（§3.3）', () => {
    const state = newGame('E1-UI-EMPTY');
    const p = player(state);
    clearInventory(p);
    const triggerRef = createRef<HTMLButtonElement>();
    const onUseItem = vi.fn();
    const onClose = vi.fn();
    act(() => {
      root.render(
        <QuickRestoreMenu player={p} slot={'hp' as RestoreSlot} triggerRef={triggerRef} onUse={onUseItem} onClose={onClose} />,
      );
    });
    const empty = container.querySelector('.quick-restore-empty');
    expect(empty).not.toBeNull();
    expect(empty!.textContent).toContain('生命');
  });

  it('双效物品在选择窗完整显示两项效果（§3.4）', () => {
    const state = newGame('E1-UI-DUAL');
    const p = player(state);
    clearInventory(p);
    give(state, p, 'herb_remedy', 1);
    const triggerRef = createRef<HTMLButtonElement>();
    const onUseItem = vi.fn();
    const onClose = vi.fn();
    act(() => {
      root.render(
        <QuickRestoreMenu player={p} slot={'hp' as RestoreSlot} triggerRef={triggerRef} onUse={onUseItem} onClose={onClose} />,
      );
    });
    const menu = container.querySelector('.quick-restore-menu');
    expect(menu!.textContent).toContain('生命 +10');
    expect(menu!.textContent).toContain('体力 +10');
  });
});
