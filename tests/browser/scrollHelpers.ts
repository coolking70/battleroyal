/**
 * 浏览器证据用的滚动辅助（Phase 4D-2）。
 *
 * 4D-2 之前中栏 `.stage` 自己滚动；4D-2 之后 `.stage` 固定住主视觉与目标条，
 * 真正滚动的是它下面的上下文保留区 `.stage-content`。若把滚动容器写死成
 * `.stage` 或 `.board`，证据脚本会"滚了个寂寞"，从而给出假阴性。
 *
 * 这里改成从目标节点向上找第一个真正可滚动的祖先，两套布局都成立。
 *
 * 注意：本文件里的函数会被 page.evaluate 序列化到页面上下文执行，
 * 因此必须自包含，不能引用模块作用域的变量或 import。
 */

export interface ActionScrollResult {
  scrollTop: number;
  visibleButtons: number;
  scrollContainer: string | null;
}

/** 把遭遇面板整体滚到保留区顶部（不关心按钮可见性）。 */
export function scrollEncounterIntoView(): void {
  const encounter = document.querySelector('.encounter') as HTMLElement | null;
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

/** 把遭遇行动区滚进视口，返回滚动后完整可见的按钮数。 */
export function scrollEncounterActionsIntoView(): ActionScrollResult {
  const actions = document.querySelector('.encounter-actions') as HTMLElement | null;
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
