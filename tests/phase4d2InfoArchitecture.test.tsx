/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { createGame, getPlayer } from '../src/core/gameState';
import { createStack } from '../src/core/inventory';
import { resolveCharacterVisualState } from '../src/ui/characterVisualState';
import { visibleEventsForPlayer } from '../src/ui/components/EventLog';
import { GameScreen } from '../src/ui/screens/GameScreen';
import { setAssetManifest, type AssetManifest } from '../src/ui/visualAssets';
import type { Combatant, GameEvent, GameState } from '../src/core/types';

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  setAssetManifest(null);
});

function render(state: GameState, player: Combatant): void {
  act(() => {
    root.render(
      <GameScreen state={state} player={player} dispatch={() => undefined} onQuit={() => undefined} />,
    );
  });
}

function newGame(seed: string): { state: GameState; player: Combatant } {
  const state = createGame({ seed, playerCharacterId: 'scout', playerName: '测试者' });
  return { state, player: getPlayer(state) };
}

/** 把玩家所在区域清空成"完全孤身、无掉落、无情报"的干净首屏 */
function isolatePlayer(state: GameState, player: Combatant): void {
  const zone = state.zones[player.currentZoneId]!;
  zone.aliveCharacterIds = [player.id];
  zone.groundItems = [];
  state.playerIntel = {};
}

describe('Phase 4D-2 §3.1 五块常驻', () => {
  it('首屏只保留状态栏 / 地图指示器 / 主视觉 / 合成目标条 / 行动栏五块常驻结构', () => {
    const { state, player } = newGame('PHASE4D2-RESIDENT');
    isolatePlayer(state, player);
    render(state, player);

    // ① 生存状态 + ② 危险指示（状态栏承载）
    expect(container.querySelector('.topbar')).not.toBeNull();
    // ④ 地图指示器（小型常驻）
    expect(container.querySelector('.zone-rail')).not.toBeNull();
    // ③ 主视觉
    expect(container.querySelector('.zone-hero')).not.toBeNull();
    // ⑤ 行动栏 + 合成目标条
    expect(container.querySelector('.actionbar')).not.toBeNull();
    expect(container.querySelector('.craft-goal-bar')).not.toBeNull();

    // 中栏只有一个 stage section，不再有左右常驻栏
    expect(container.querySelectorAll('.board > section')).toHaveLength(1);
    expect(container.querySelector('.board .col-left')).toBeNull();
    // 基线的常驻地图 / 情报面板不再挂在主布局上：
    // 地图整体迁入按需抽屉，情报改为上下文触发
    expect(container.querySelector('.board .zone-nav-panel')).toBeNull();
    expect(container.querySelector('.map-drawer-panel .zone-nav-panel')).not.toBeNull();
    expect(container.querySelector('.intel-panel')).toBeNull();
  });

  it('§3.4 主视觉是「角色立绘 + 区域背景」的合成，背景不降级为缩略图', () => {
    const manifest: AssetManifest = {
      version: 1,
      characters: { scout: { portrait: '/assets/characters/scout/portrait.png' } },
      zones: { forest: { background: '/assets/zones/forest/background.png' } },
      items: {},
      worldEvents: {},
    };
    setAssetManifest(manifest);
    const { state, player } = newGame('PHASE4D2-HERO');
    player.currentZoneId = 'forest';
    isolatePlayer(state, player);
    render(state, player);

    const hero = container.querySelector('.zone-hero') as HTMLElement;
    expect(hero).not.toBeNull();
    // 区域背景仍是 hero 尺度的底图（同一个 .zone-hero 容器内），不是小缩略图
    expect(hero.querySelector('.zone-hero-image')?.getAttribute('src')).toBe(
      '/assets/zones/forest/background.png',
    );
    // 角色立绘是主体
    expect(hero.querySelector('.zone-hero-portrait')?.getAttribute('src')).toBe(
      '/assets/characters/scout/portrait.png',
    );
    // 区域名 / 状态 / 描述可读
    expect(hero.querySelector('h2')?.textContent).toContain('森林');
    expect(hero.querySelector('.zone-hero-status')?.textContent?.length ?? 0).toBeGreaterThan(0);
    expect(hero.querySelector('p')?.textContent?.length ?? 0).toBeGreaterThan(0);
  });

  it('§3.4 立绘随 resolveCharacterVisualState 在 portrait / injured / combat 三态间切换', () => {
    const manifest: AssetManifest = {
      version: 1,
      characters: {
        scout: {
          portrait: '/assets/characters/scout/portrait.png',
          injured: '/assets/characters/scout/injured.png',
          combat: '/assets/characters/scout/combat.png',
        },
      },
      zones: {},
      items: {},
      worldEvents: {},
    };
    setAssetManifest(manifest);

    const portraitSrc = () =>
      container.querySelector('.zone-hero-portrait')?.getAttribute('src');

    // portrait：满血、无遭遇
    const a = newGame('PHASE4D2-VISUAL-PORTRAIT');
    isolatePlayer(a.state, a.player);
    render(a.state, a.player);
    expect(resolveCharacterVisualState(a.player, { activeEncounter: false })).toBe('portrait');
    expect(portraitSrc()).toBe('/assets/characters/scout/portrait.png');

    // combat：满血、遭遇进行中
    const b = newGame('PHASE4D2-VISUAL-COMBAT');
    isolatePlayer(b.state, b.player);
    const enemyB = Object.values(b.state.characters).find((c) => !c.isPlayer)!;
    enemyB.currentZoneId = b.player.currentZoneId;
    b.state.encounter = {
      enemyId: enemyB.id,
      zoneId: b.player.currentZoneId,
      startedAtTime: b.state.time,
      log: [],
      resolved: false,
    };
    render(b.state, b.player);
    expect(resolveCharacterVisualState(b.player, { activeEncounter: true })).toBe('combat');
    expect(portraitSrc()).toBe('/assets/characters/scout/combat.png');

    // injured：HP 比 ≤ 0.35 时压过 combat
    const c = newGame('PHASE4D2-VISUAL-INJURED');
    isolatePlayer(c.state, c.player);
    c.player.hp = Math.floor(c.player.maxHp * 0.2);
    render(c.state, c.player);
    expect(resolveCharacterVisualState(c.player, { activeEncounter: false })).toBe('injured');
    expect(portraitSrc()).toBe('/assets/characters/scout/injured.png');
  });
});

describe('Phase 4D-2 §3.3 上下文触发：无内容不渲染、不占位', () => {
  it('干净首屏没有任何空态文案，上下文保留区整段不渲染', () => {
    const { state, player } = newGame('PHASE4D2-EMPTY');
    isolatePlayer(state, player);
    render(state, player);

    const text = container.textContent ?? '';
    const baselineEmptyTexts = [
      '还没有任何情报。',
      '这里暂时只有你一个人。',
      '地上没有可拾取的东西。',
      '背包是空的。',
      '空槽',
      '暂无可装备候选',
    ];
    for (const needle of baselineEmptyTexts) {
      expect(text, `首屏不应出现空态文案「${needle}」`).not.toContain(needle);
    }

    // 上下文块本身不存在（不是"存在但为空"）
    expect(container.querySelector('.context-intel')).toBeNull();
    expect(container.querySelector('.stage-content .presence')).toBeNull();
    expect(container.querySelector('.stage-content .ground-list')).toBeNull();
    expect(container.querySelector('.stage-content .search-result')).toBeNull();
    expect(container.querySelector('.stage-content .encounter')).toBeNull();
    expect(container.querySelector('.stage-content .pending')).toBeNull();
  });

  it('有内容时上下文块才出现，且落在同一个固定保留区内（§4.1 主视觉与行动栏不位移）', () => {
    const { state, player } = newGame('PHASE4D2-CONTEXT');
    isolatePlayer(state, player);
    render(state, player);
    const heroBefore = container.querySelector('.zone-hero')!;
    const actionBefore = container.querySelector('.actionbar')!;

    // 注入情报 + 同区域他人 + 地面掉落
    const npc = Object.values(state.characters).find((c) => !c.isPlayer)!;
    state.playerIntel = { [npc.id]: { zoneId: npc.currentZoneId, atTime: state.time, source: 'sight' } };
    state.zones[player.currentZoneId]!.aliveCharacterIds = [player.id, npc.id];
    state.zones[player.currentZoneId]!.groundItems = [createStack(state, 'wood')];
    render({ ...state }, player);

    const stageContent = container.querySelector('.stage-content')!;
    expect(stageContent.querySelector('.context-intel')).not.toBeNull();
    expect(stageContent.querySelector('.presence')).not.toBeNull();
    expect(stageContent.querySelector('.ground-list')).not.toBeNull();

    // 主视觉与行动栏在 DOM 顺序上未被上下文内容挤走：
    // hero 仍在 stage-content 之前，actionbar 仍在 board 之后
    const stage = container.querySelector('.stage')!;
    const children = Array.from(stage.children);
    expect(children.indexOf(container.querySelector('.zone-hero')!)).toBeLessThan(
      children.indexOf(stageContent),
    );
    expect(container.querySelector('.zone-hero')).toBe(heroBefore);
    expect(container.querySelector('.actionbar')).toBe(actionBefore);
    expect(container.querySelector('.board')!.nextElementSibling).toBe(actionBefore);
  });
});

describe('Phase 4D-2 §3.2 按需展开', () => {
  it('完整六区地图默认不展开，点击地图指示器后展开且信息无损', () => {
    const { state, player } = newGame('PHASE4D2-MAP');
    isolatePlayer(state, player);
    render(state, player);

    expect(container.querySelector('.map-slot')).not.toBeNull();
    expect(container.querySelector('.map-slot-open')).toBeNull();

    const trigger = container.querySelector('.zone-rail-expand') as HTMLButtonElement;
    expect(trigger).not.toBeNull();
    act(() => trigger.click());

    expect(container.querySelector('.map-slot-open')).not.toBeNull();
    // 展开后六区完整可见（与基线常驻地图信息等价）
    expect(container.querySelectorAll('.map-drawer-panel .zone-item')).toHaveLength(6);
    expect(document.activeElement).toBe(container.querySelector('.map-drawer-close'));

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(container.querySelector('.map-slot-open')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('地图指示器常驻时只给当前 + 相邻 + 警告，不铺开六区', () => {
    const { state, player } = newGame('PHASE4D2-RAIL');
    isolatePlayer(state, player);
    render(state, player);

    const rail = container.querySelector('.zone-rail')!;
    expect(rail.querySelector('.zone-rail-current')).not.toBeNull();
    const chips = rail.querySelectorAll('.zone-chip');
    expect(chips.length).toBeGreaterThan(0);
    expect(chips.length).toBeLessThan(6);
    // 指示器自身不含完整六区网格
    expect(rail.querySelectorAll('.zone-item')).toHaveLength(0);
  });

  it('背包与装备合并为同一个入口（一个 Tab，不再是两块）', () => {
    const { state, player } = newGame('PHASE4D2-INVENTORY');
    isolatePlayer(state, player);
    render(state, player);

    const tabs = Array.from(container.querySelectorAll('.planning-tabs button'));
    expect(tabs).toHaveLength(3);
    expect(tabs[0]!.textContent).toContain('背包');
    expect(tabs[0]!.textContent).toContain('装备');

    const trigger = container.querySelector('.planning-drawer-trigger') as HTMLButtonElement;
    act(() => trigger.click());
    const panel = container.querySelector('#planning-tabpanel-inventory')!;
    // 装备槽与背包列表在同一个面板里
    expect(panel.querySelector('.equip-row')).not.toBeNull();
    expect(panel.querySelector('.inv-list')).not.toBeNull();
  });

  it('规划抽屉与地图抽屉都是按需展开，默认互不占据常驻空间', () => {
    const { state, player } = newGame('PHASE4D2-DRAWERS');
    isolatePlayer(state, player);
    render(state, player);

    expect(container.querySelector('.planning-slot-open')).toBeNull();
    expect(container.querySelector('.map-slot-open')).toBeNull();
    expect(container.querySelector('.planning-drawer-trigger')?.getAttribute('aria-expanded')).toBe('false');

    // 两个抽屉的 DOM 常驻（便于焦点管理与测试），但通过 slot-open 控制呈现
    expect(container.querySelectorAll('.planning-drawer-panel')).toHaveLength(1);
    expect(container.querySelectorAll('.map-drawer-panel')).toHaveLength(1);
  });
});

describe('Phase 4D-2 §5 约束回归', () => {
  it('真实 DOM 上没有任何 [title] 属性（4B-6 恒为 0）', () => {
    const { state, player } = newGame('PHASE4D2-TITLE');
    const npc = Object.values(state.characters).find((c) => !c.isPlayer)!;
    state.zones[player.currentZoneId]!.aliveCharacterIds = [player.id, npc.id];
    state.zones[player.currentZoneId]!.groundItems = [createStack(state, 'wood')];
    state.playerIntel = { [npc.id]: { zoneId: npc.currentZoneId, atTime: state.time, source: 'sight' } };
    render(state, player);
    expect(container.querySelectorAll('[title]')).toHaveLength(0);

    // 两个抽屉全开时同样为 0
    act(() => (container.querySelector('.planning-drawer-trigger') as HTMLButtonElement).click());
    act(() => (container.querySelector('.zone-rail-expand') as HTMLButtonElement).click());
    expect(container.querySelectorAll('[title]')).toHaveLength(0);
  });

  it('新增的常驻/展开控件都有可读无障碍名，状态不只靠颜色', () => {
    const { state, player } = newGame('PHASE4D2-A11Y');
    isolatePlayer(state, player);
    render(state, player);

    const railCurrent = container.querySelector('.zone-rail-current') as HTMLButtonElement;
    expect(railCurrent.getAttribute('aria-label')).toContain('当前区域');
    const expand = container.querySelector('.zone-rail-expand') as HTMLButtonElement;
    expect(expand.getAttribute('aria-label')).toContain('地图');
    expect(expand.getAttribute('aria-haspopup')).toBe('dialog');
    expect(container.querySelector('.zone-rail')?.getAttribute('aria-label')).toContain('地图');

    // 状态既有图标也有文字，不依赖颜色
    const cue = container.querySelector('.zone-rail-current .zone-state-cue')!;
    expect(cue.querySelector('.zone-state-icon')).not.toBeNull();
    expect((cue.textContent ?? '').replace(/\s/g, '').length).toBeGreaterThan(1);

    // 相邻区域 chip 的无障碍名带状态与噪音，不只靠 chip 颜色
    const chip = container.querySelector('.zone-chip') as HTMLButtonElement;
    expect(chip.getAttribute('aria-label')).toContain('移动到');
    expect(chip.getAttribute('aria-label')).toContain('噪音');
  });

  it('地图指示器不泄露远处区域的地面库存与 NPC 位置', () => {
    const { state, player } = newGame('PHASE4D2-BOUNDARY-RAIL');
    isolatePlayer(state, player);
    const remoteZoneId = Object.keys(state.zones).find((id) => id !== player.currentZoneId)!;
    state.zones[remoteZoneId]!.groundItems = [createStack(state, 'iron')];
    const npc = Object.values(state.characters).find((c) => !c.isPlayer)!;
    npc.currentZoneId = remoteZoneId;
    state.zones[remoteZoneId]!.aliveCharacterIds = [npc.id];
    render(state, player);

    const railText = container.querySelector('.zone-rail')?.textContent ?? '';
    expect(railText).not.toContain('铁块');
    expect(railText).not.toContain('掉落');
    expect(railText).not.toContain(npc.name);
  });

  it('日志组件仍走 visibleEventsForPlayer，NPC 内部计划不外泄', () => {
    const hiddenNpcEvent: GameEvent = {
      id: 'phase4d2-hidden-npc',
      type: 'NPC_ACTION',
      time: 3,
      actorId: 'npc-1',
      targetId: null,
      zoneId: 'forest',
      message: '青苔（search）：搜索当前区域（物资 100%）',
      importance: 'minor',
      metadata: { kind: 'search', reason: '搜索当前区域（物资 100%）' },
    };
    const ownAction: GameEvent = {
      ...hiddenNpcEvent,
      id: 'phase4d2-own-action',
      type: 'SEARCH_STARTED',
      actorId: 'p0',
      message: '你在森林搜索。',
    };

    const visible = visibleEventsForPlayer([hiddenNpcEvent, ownAction], 'p0');
    expect(visible.map((item) => item.id)).toEqual(['phase4d2-own-action']);

    const { state, player } = newGame('PHASE4D2-LOG');
    isolatePlayer(state, player);
    state.events = [...state.events, hiddenNpcEvent, { ...ownAction, actorId: player.id }];
    render(state, player);
    act(() => (container.querySelector('.planning-drawer-trigger') as HTMLButtonElement).click());

    const logText = container.querySelector('.log-panel')?.textContent ?? '';
    expect(logText).not.toContain('物资 100%');
    expect(logText).not.toContain('（search）');
  });
});

describe('Phase 4D-2 §7 版式口径', () => {
  it('样式表把上下文保留区与主视觉/行动栏解耦，避免上下文内容推挤主视觉', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'src/ui/styles.css'), 'utf8');
    // 主视觉与目标条钉死不参与伸缩，上下文区自己滚动
    expect(css).toContain('.stage > .craft-goal-bar,');
    expect(css).toContain('.stage-content {');
    expect(css).toContain('.stage-content:empty');
    // 两个抽屉都是全视口 off-canvas
    expect(css).toContain('.map-drawer-panel');
    expect(css).toContain('.map-slot-open .map-drawer-panel');
    // 常驻三列栅格已移除
    expect(css).not.toContain('grid-template-columns: 232px minmax(0, 1fr) 288px');
  });

  it('规划触发器获焦时不会被 focus-visible 的 position: relative 打回文档流', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'src/ui/styles.css'), 'utf8');
    // 共享的 focus-visible 规则用 `position: relative` 提层级。触发器是 fixed 浮动按钮，
    // 一旦被打回文档流就会摊成整宽横条压住行动栏、拦截「搜索/休息」的点击。
    const sharedFocusRule = css.slice(
      css.indexOf('.btn:focus-visible'),
      css.indexOf('.btn:focus-visible') + 400,
    );
    expect(sharedFocusRule).not.toContain('.planning-drawer-trigger:focus-visible');
    // 且必须有一条专属规则把 fixed 定位显式重申回来（它同时是 .btn，会被通用规则命中）
    const ownRule = css.slice(css.indexOf('.planning-drawer-trigger:focus-visible'));
    expect(ownRule.slice(0, 160)).toContain('position: fixed');
  });

  it('度量口径模块与真实 DOM 选择器一致（防止度量数字虚高/虚低）', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'tests/browser/infoArchitectureMetrics.ts'),
      'utf8',
    );
    // 这几个选择器必须与组件根类名对齐，否则 §7 数字不可信
    expect(source).toContain(".stage-content .search-result'");
    expect(source).toContain(".stage-content .pending'");
    expect(source).toContain(".zone-rail'");
    expect(source).not.toContain('.search-feedback');
    expect(source).not.toContain('.pending-pickup');
    // 常驻 vs 上下文必须分开统计：`.presence` 在基线无条件渲染、在 4D-2 条件渲染，
    // 混在一起数会让两版数字不可比。
    expect(source).toContain('RESIDENT_CANDIDATES');
    expect(source).toContain('CONTEXTUAL_CANDIDATES');
    expect(source).toContain('const isPhase4d2 = Boolean(document.querySelector(\'.zone-rail\'))');
  });

  it('同区域块在 4D-2 是条件渲染（没人就不占首屏）', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/ui/screens/GameScreen.tsx'),
      'utf8',
    );
    // 基线是无条件 `<div className="stage-section">` + `.presence`；
    // 4D-2 必须包在 presence !== 'none' 里，否则首屏空态回归。
    expect(source).toContain("{presence !== 'none' && (");
  });
});
