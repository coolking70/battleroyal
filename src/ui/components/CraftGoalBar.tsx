import type { CraftGoalBanner } from '../craftPathPresentation';

interface CraftGoalBarProps {
  banner: CraftGoalBanner | null;
  /** 打开规划抽屉并切到「合成」tab */
  onOpenCraft: () => void;
}

/**
 * 中栏常驻合成目标条（Phase 4D-1 改进 C）。
 *
 * 这是一条**纯增补**的 sticky 单行：它挂在中栏滚动容器 `.stage` 的顶部，
 * 不参与既有布局的重排，不移除也不隐藏任何面板，
 * 更不占用 ActionBar 与遭遇战按钮所在的底部区域（那是 P0 的地盘）。
 *
 * 它只回答四个问题：目标是什么 / 现在该做哪一步 / 还缺什么 / 去哪找。
 * 所有数据都来自 `craftGoalBanner`，信息边界与合成 tab 完全一致：
 * 只读玩家自己的背包与区域**公开**物资池，绝不泄露区域实际剩余库存。
 */
export function CraftGoalBar({
  banner,
  onOpenCraft,
}: CraftGoalBarProps): JSX.Element | null {
  if (!banner) return null;

  const kindLabel = banner.kind === 'goal' ? '制作目标' : '建议目标';
  const stepText = banner.completed
    ? '已达成，可装备使用'
    : banner.nextStepName
      ? `先做「${banner.nextStepName}」`
      : banner.finalCraftable
        ? '材料齐备，可直接合成'
        : banner.rawReady
          ? '原料齐全，等待完成前置步骤'
          : '仍缺原始材料';

  return (
    <div
      className="craft-goal-bar"
      data-craft-goal-bar={banner.kind}
      data-craft-goal-recipe={banner.recipeId}
      role="status"
      aria-label={`${kindLabel}：${banner.name}，${stepText}`}
    >
      <span className="cgb-icon" aria-hidden="true">
        ⚒
      </span>
      <span className="cgb-kind">{kindLabel}</span>
      <strong className="cgb-name">{banner.name}</strong>
      <span className="cgb-step" data-craft-goal-step="true">
        {stepText}
      </span>
      {!banner.completed && banner.gaps.length > 0 && (
        <span className="cgb-gaps" data-craft-goal-gaps="true">
          缺{' '}
          {banner.gaps.map((gap) => `${gap.name}×${gap.missing}`).join('、')}
        </span>
      )}
      {!banner.completed && banner.sourceZoneNames.length > 0 && (
        <span className="cgb-where" data-craft-goal-where="true">
          去 {banner.sourceZoneNames.join('、')} 找
        </span>
      )}
      <button
        className="btn btn-sm btn-ghost cgb-open"
        onClick={onOpenCraft}
        aria-label={`打开合成面板查看${banner.name}的完整路线`}
      >
        合成面板
      </button>
    </div>
  );
}
