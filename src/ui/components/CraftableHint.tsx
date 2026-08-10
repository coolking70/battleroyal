import type { RecipeView } from '../../core/crafting';
import { getItem } from '../../data/items';

interface CraftableHintProps {
  view: RecipeView;
  /** 合成必须走既有命令通道（与 CraftPanel 同一条），不得绕过 */
  onCraft: (recipeId: string) => void;
  onDismiss: () => void;
}

/**
 * 可合成提示卡（Phase 4E-1 改进 B）。
 *
 * - 复用 4B-3 搜索结果卡的卡片范式（aside + 图标 + 主体 + 行动按钮），
 *   且是**非阻塞**、**非常驻占位**：仅在"新获得物品使某配方可做"时出现，
 *   可被「忽略」关闭；下一帧若配方不再可做也会自动消失。
 * - 可直接发起合成（onCraft），不必切到合成面板。
 */
export function CraftableHint({ view, onCraft, onDismiss }: CraftableHintProps): JSX.Element {
  const out = getItem(view.recipe.outputItemId);
  return (
    <aside
      className="craftable-hint"
      data-craftable-hint="true"
      aria-live="polite"
    >
      <span className="craftable-hint-icon" aria-hidden="true">⚒</span>
      <div className="craftable-hint-body">
        <div className="craftable-hint-kicker">材料已集齐 · 可合成</div>
        <strong className="craftable-hint-name">{view.recipe.name}</strong>
        <div className="craftable-hint-meta">{out.name} · 体力 -{view.staminaCost}</div>
      </div>
      <div className="craftable-hint-actions">
        <button
          type="button"
          className="btn btn-sm btn-primary"
          data-craftable-hint-craft="true"
          disabled={!view.craftable}
          onClick={() => onCraft(view.recipe.id)}
        >
          合成
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          data-craftable-hint-dismiss="true"
          onClick={onDismiss}
          aria-label="忽略可合成提示"
        >
          忽略
        </button>
      </div>
    </aside>
  );
}
