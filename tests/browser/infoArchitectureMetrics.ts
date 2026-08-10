/**
 * Phase 4D-2 信息架构度量口径（新旧两版共用）。
 *
 * 这份口径同时覆盖基线（ce508cf，9 块常驻）和 4D-2（5 块常驻），
 * 因此同一段脚本既能量基线也能量改造后，两组数字才是可比的。
 *
 * 所有度量都在真实浏览器里对真实 DOM 做，不看源码、不看 React 树。
 */

export interface InfoArchitectureMetrics {
  viewport: { width: number; height: number };
  /**
   * 首屏可见的**常驻**信息区块。
   *
   * 常驻的定义（两版通用、可核对）：该区块在 JSX 里是无条件渲染的结构壳，
   * 它在不在场只取决于布局决策，与当局世界状态无关。
   * 基线里 `.presence`（同区域）是无条件渲染 → 常驻；
   * 4D-2 里它被收进 `presence !== 'none'` 条件 → 归上下文块，不计常驻。
   */
  residentBlocks: string[];
  residentBlockCount: number;
  /** 首屏可见的**上下文触发**区块（有内容才出现，数量随世界状态波动） */
  contextualBlocks: string[];
  contextualBlockCount: number;
  /** 首屏可见的信息区块总数 = 常驻 + 上下文 */
  firstScreenBlockCount: number;
  /** 首屏可见的空态文案（命中固定文案表的那些） */
  emptyStateTexts: string[];
  emptyStateCount: number;
  /** 装备 + 背包 + 地图 三者常驻占用的视口面积比 */
  equipInventoryMapShare: {
    equipAreaPx: number;
    inventoryAreaPx: number;
    mapAreaPx: number;
    viewportAreaPx: number;
    sharePercent: number;
  };
  /** 首屏可见且可操作的交互控件数量 */
  visibleInteractiveControls: number;
  visibleInteractiveLabels: string[];
  /** 真实 DOM 上的 [title] 属性数量（4B-6 要求恒为 0） */
  titleAttributeCount: number;
  /** 横向溢出自检 */
  horizontalOverflow: {
    innerWidth: number;
    bodyScrollWidth: number;
    documentScrollWidth: number;
    overflow: boolean;
  };
}

/**
 * 在页面上下文里执行的度量函数。
 * 必须是自包含的（page.evaluate 会把它序列化过去），不能引用模块作用域变量。
 */
export function measureInfoArchitecture(): InfoArchitectureMetrics {
  /**
   * 常驻结构壳候选：JSX 里无条件渲染、在不在场只由布局决定的区块。
   * 同时列出基线与 4D-2 两版的选择器，命中即计数。
   *
   * 注意 `.presence` 不在这里 —— 它在基线是无条件的、在 4D-2 是条件渲染的，
   * 归属会随版本改变，因此单独用 PRESENCE_IS_RESIDENT 在运行时判定。
   */
  const RESIDENT_CANDIDATES: Array<[string, string]> = [
    ['状态栏', '.topbar'],
    ['地图（常驻面板 · 基线）', '.zone-nav-panel:not(.map-drawer-panel .zone-nav-panel)'],
    ['地图指示器（4D-2 常驻小型）', '.zone-rail'],
    ['情报（常驻面板 · 基线）', '.intel-panel'],
    ['合成目标条', '.craft-goal-bar'],
    ['主视觉', '.zone-hero'],
    ['规划区（背包/合成/图鉴）', '.planning-panel'],
    ['历史日志', '.log-panel'],
    ['行动栏', '.actionbar'],
  ];

  /** 上下文触发块候选：有内容才出现，数量随世界状态波动，不计入常驻。 */
  const CONTEXTUAL_CANDIDATES: Array<[string, string]> = [
    ['情报（4D-2 上下文触发）', '.context-intel'],
    ['同区域', '.stage-content .presence'],
    ['地面掉落', '.stage-content .ground-list'],
    ['搜索结果', '.stage-content .search-result'],
    ['遭遇面板', '.stage-content .encounter'],
    ['待处理拾取', '.stage-content .pending'],
    ['世界事件横幅', '.stage-content .event-banner-wrap'],
  ];

  /**
   * 版本判定：4D-2 把常驻六区地图面板换成了小型指示器 `.zone-rail`，
   * 基线没有这个节点。用它区分两版，比嗅探空态文案稳定得多。
   *
   * 基线把「同区域」当无条件常驻面板（没人时显示空态「这里暂时只有你一个人。」），
   * 4D-2 把它收进 `presence !== 'none'` 条件渲染 —— 所以同一个选择器在两版里
   * 归属不同，必须按版本分类，否则两组数字不可比。
   */
  const isPhase4d2 = Boolean(document.querySelector('.zone-rail'));

  /** 空态文案表：基线首屏出现过的全部 9 条 */
  const EMPTY_TEXTS = [
    '还没有任何情报。',
    '这里暂时只有你一个人。',
    '地上没有可拾取的东西。',
    '背包是空的。',
    '空槽',
    '暂无可装备候选',
    '有可装备候选',
    '暂无记录。',
    '暂无公开来源池',
  ];

  function isVisible(el: Element): boolean {
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (Number(style.opacity) === 0) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    // 必须与视口有交集才算"首屏可见"
    return rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
  }

  function visibleArea(selector: string): number {
    let total = 0;
    document.querySelectorAll(selector).forEach((el) => {
      if (!isVisible(el)) return;
      const rect = el.getBoundingClientRect();
      const w = Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0));
      const h = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0));
      total += w * h;
    });
    return Math.round(total);
  }

  const hits = (selector: string): boolean =>
    Array.from(document.querySelectorAll(selector)).some((el) => isVisible(el));

  const residentCandidates = isPhase4d2
    ? RESIDENT_CANDIDATES
    : [...RESIDENT_CANDIDATES, ['同区域', '.stage-content .presence'] as [string, string]];
  const contextualCandidates = isPhase4d2
    ? CONTEXTUAL_CANDIDATES
    : CONTEXTUAL_CANDIDATES.filter(([label]) => label !== '同区域');

  const residentBlocks: string[] = [];
  residentCandidates.forEach(([label, selector]) => {
    if (hits(selector)) residentBlocks.push(label);
  });

  const contextualBlocks: string[] = [];
  contextualCandidates.forEach(([label, selector]) => {
    if (hits(selector)) contextualBlocks.push(label);
  });

  const emptyStateTexts: string[] = [];
  EMPTY_TEXTS.forEach((needle) => {
    document.querySelectorAll('div, span, p, li, td').forEach((el) => {
      if (el.querySelector('div, span, p, li, td')) return; // 只数叶子节点，避免父级重复计数
      if (!(el.textContent ?? '').includes(needle)) return;
      if (!isVisible(el)) return;
      emptyStateTexts.push(needle);
    });
  });

  const viewportAreaPx = innerWidth * innerHeight;
  const equipAreaPx = visibleArea('.equip-row');
  const inventoryAreaPx = visibleArea('.inv-list');
  const mapAreaPx = visibleArea('.zone-nav-panel, .zone-rail');

  const interactive: string[] = [];
  document
    .querySelectorAll<HTMLElement>(
      'button, [role="button"], input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])',
    )
    .forEach((el) => {
      if (el.hasAttribute('disabled')) return;
      if (el.getAttribute('aria-hidden') === 'true') return;
      if (!isVisible(el)) return;
      const label =
        el.getAttribute('aria-label') ??
        (el.textContent ?? '').trim().slice(0, 24) ??
        el.tagName.toLowerCase();
      interactive.push(label || el.tagName.toLowerCase());
    });

  return {
    viewport: { width: innerWidth, height: innerHeight },
    residentBlocks,
    residentBlockCount: residentBlocks.length,
    contextualBlocks,
    contextualBlockCount: contextualBlocks.length,
    firstScreenBlockCount: residentBlocks.length + contextualBlocks.length,
    emptyStateTexts,
    emptyStateCount: emptyStateTexts.length,
    equipInventoryMapShare: {
      equipAreaPx,
      inventoryAreaPx,
      mapAreaPx,
      viewportAreaPx,
      sharePercent:
        Math.round(((equipAreaPx + inventoryAreaPx + mapAreaPx) / viewportAreaPx) * 1000) / 10,
    },
    visibleInteractiveControls: interactive.length,
    visibleInteractiveLabels: interactive,
    titleAttributeCount: document.querySelectorAll('[title]').length,
    horizontalOverflow: {
      innerWidth,
      bodyScrollWidth: document.body.scrollWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      overflow:
        document.body.scrollWidth > innerWidth || document.documentElement.scrollWidth > innerWidth,
    },
  };
}
