/**
 * 浏览器证据用的滚动辅助（Phase 4D-3）。
 *
 * 4D-3 起遭遇态并入主视觉：不再有独立的 `.encounter` 面板或内部的
 * `.encounter-actions` 行动区，取而代之的是主视觉里的 `.encounter-hero`
 * 与底部共用行动栏里的 `.actionbar-combat-actions`（始终钉在视口底部，
 * 6 个战斗动作无需滚动即可触达）。
 *
 * 这里把目标选择器从旧的 `.encounter` / `.encounter-actions` 改指 4D-3 的
 * `.encounter-hero` / `.actionbar-combat-actions`，其余"向上找第一个可滚动祖先"
 * 的逻辑不变，两套布局都成立。
 *
 * 注意：本文件里的函数会被 page.evaluate 序列化到页面上下文执行，
 * 因此必须自包含，不能引用模块作用域的变量或 import。
 */

export interface ActionScrollResult {
  scrollTop: number;
  visibleButtons: number;
  scrollContainer: string | null;
}

/** 把遭遇态主视觉（.encounter-hero）整体滚进视口（不关心按钮可见性）。 */
export function scrollEncounterIntoView(): void {
  const encounter = document.querySelector('.encounter-hero') as HTMLElement | null;
  if (!encounter) return;

  let current: HTMLElement | null = encounter.parentElement;
  while (current) {
    const style = getComputedStyle(current);
    if (/(auto|scroll|overlay)/.test(style.overflowY) && current.scrollHeight > current.clientHeight + 1) {
      current.scrollTop = Math.max(0, encounter.offsetTop - current.offsetTop - 12);
      return;
    }
    current = current.parentElement;
  }
}

/** 把遭遇行动区（共用行动栏的 .actionbar-combat-actions）滚进视口，返回滚动后完整可见的按钮数。 */
export function scrollEncounterActionsIntoView(): ActionScrollResult {
  const actions = document.querySelector('.actionbar-combat-actions') as HTMLElement | null;
  const topbarBottom = document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 0;
  if (!actions) return { scrollTop: 0, visibleButtons: 0, scrollContainer: null };

  const scrollableAncestor = (node: HTMLElement): HTMLElement => {
    let current: HTMLElement | null = node.parentElement;
    while (current) {
      const style = getComputedStyle(current);
      const scrollable = /(auto|scroll|overlay)/.test(style.overflowY);
      if (scrollable && current.scrollHeight > current.clientHeight + 1) return current;
      current = current.parentElement;
    }
    return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
  };

  const container = scrollableAncestor(actions);
  const before = actions.getBoundingClientRect();
  // 目标：行动区底部尽量贴着视口底，同时顶部不被状态栏盖住。
  const desiredTop = Math.max(
    topbarBottom + 8,
    Math.min(before.top, innerHeight - before.height - 8),
  );
  container.scrollTop = Math.max(0, container.scrollTop + before.top - desiredTop);

  const visibleButtons = Array.from(actions.querySelectorAll('button')).filter((button) => {
    const rect = button.getBoundingClientRect();
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.top >= topbarBottom &&
      rect.bottom <= innerHeight
    );
  }).length;

  return {
    scrollTop: container.scrollTop,
    visibleButtons,
    scrollContainer: container.className || container.tagName.toLowerCase(),
  };
}
