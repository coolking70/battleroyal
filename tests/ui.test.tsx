/**
 * @vitest-environment jsdom
 *
 * 界面冒烟测试。
 * 不依赖任何测试库，直接用 react-dom/client 把 App 挂到 jsdom 上，
 * 验证「主菜单 -> 开局 -> 行动 -> 存档」这条主链路不会抛错。
 */
import { StrictMode, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from '../src/App';
import { CHARACTERS } from '../src/data/characters';
import { SAVE_KEY } from '../src/data/gameConfig';

let container: HTMLDivElement;
let root: Root;

// React 18 的 act 需要这个全局开关
declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  if (typeof localStorage.clear !== 'function') {
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, String(value)),
        removeItem: (key: string) => values.delete(key),
      },
    });
  }
  localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(): void {
  act(() => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
}

/** 按可见文本找到一个按钮 */
function findButton(text: string): HTMLButtonElement {
  const btn = Array.from(container.querySelectorAll('button')).find((b) =>
    (b.textContent ?? '').includes(text),
  );
  if (!btn) throw new Error(`找不到按钮：${text}`);
  return btn as HTMLButtonElement;
}

function click(text: string): void {
  const btn = findButton(text);
  act(() => {
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

describe('界面冒烟', () => {
  it('主菜单能渲染完整职业阵容与技能摘要', () => {
    render();
    expect(container.textContent).toContain('区域大逃杀');
    expect(CHARACTERS.length).toBeGreaterThanOrEqual(8);
    expect(container.querySelectorAll('.char-card')).toHaveLength(CHARACTERS.length);
    expect(
      Array.from(container.querySelectorAll('.char-stats span')).some((node) =>
        /^(制作|医疗)\s/.test(node.textContent ?? ''),
      ),
    ).toBe(true);
    expect(container.querySelectorAll('.char-skills')).toHaveLength(CHARACTERS.length);
    expect(container.querySelector('[data-character-id="survivor"]')?.textContent).toContain('第二呼吸');
    expect(container.querySelector('[data-character-id="trapper"]')?.textContent).toContain('埋伏准备');
    expect(findButton('开始新对局').disabled).toBe(false);
    // 没有存档时「继续」按钮应当是禁用的
    expect(findButton('没有可继续的存档').disabled).toBe(true);
  });

  it('开局后进入对局界面，并写入 localStorage 自动存档', () => {
    render();
    click('开始新对局');

    expect(container.querySelector('.game')).not.toBeNull();
    expect(container.textContent).toContain('路线规划');
    // Phase 4D-2：「同区域」改为上下文触发。开局同区域无人时整段不渲染，
    // 不再出现「这里暂时只有你一个人」这类空态占位。
    expect(container.querySelector('.zone-rail')).not.toBeNull();
    expect(container.textContent).not.toContain('这里暂时只有你一个人');
    expect(localStorage.getItem(SAVE_KEY)).not.toBeNull();
  });

  it('点击搜索会推进时间单位', () => {
    render();
    click('开始新对局');

    const readTime = (): number => {
      const text = container.querySelector('.topbar')?.textContent ?? '';
      const m = /时间\s*(\d+)/.exec(text);
      if (!m) throw new Error(`状态栏里读不到时间：${text}`);
      return Number(m[1]);
    };

    expect(readTime()).toBe(0);
    click('搜索');
    expect(readTime()).toBe(1);
  });

  it('切到合成页能看到配方列表', () => {
    render();
    click('开始新对局');
    click('合成');
    expect(container.querySelectorAll('.recipe').length).toBeGreaterThan(0);
  });

  it('规划区移除冗余日志 tab，但历史日志仍常驻可见', () => {
    render();
    click('开始新对局');
    expect(container.querySelectorAll('.planning-tabs button')).toHaveLength(3);
    expect(container.textContent).toContain('图鉴');
    expect(container.textContent).toContain('对局开始');
    expect(container.querySelector('.log-panel')).not.toBeNull();
  });

  it('重新挂载后可以从存档继续', () => {
    render();
    click('开始新对局');
    click('搜索');
    act(() => root.unmount());

    root = createRoot(container);
    render();
    click('继续上次对局');
    expect(container.querySelector('.game')).not.toBeNull();
  });

  it('debug=1 时面板展示技能冷却 / 战斗风格概率 / 事件 / RNG 状态', () => {
    // 模拟 ?debug=1
    const url = new URL(window.location.href);
    url.searchParams.set('debug', '1');
    window.history.replaceState({}, '', url.toString());

    render();
    click('开始新对局');

    const text = container.querySelector('.debug')?.textContent ?? '';
    expect(text).toContain('技能冷却');
    expect(text).toContain('战斗风格概率');
    expect(text).toContain('事件');
    expect(text).toContain('RNG 状态');
    expect(text).toContain('同种子可完全重放');
  });

  it('暴露紧凑的 render_game_to_text 状态供自动化试玩读取', () => {
    render();
    expect(window.render_game_to_text?.()).toContain('"mode":"menu"');
    click('开始新对局');
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}') as { mode: string; player: { zoneId: string } };
    expect(state.mode).toBe('playing');
    expect(state.player.zoneId).toBeTruthy();
  });
});
