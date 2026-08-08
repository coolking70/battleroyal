import type { CraftGoalRecommendation } from '../../core/craftGuide';
import type { RecipeView } from '../../core/crafting';
import { getItem } from '../../data/items';
import { getZoneDef } from '../../data/zones';
import { CATEGORY_LABEL, itemSummary, stackLabel } from '../../utils/format';

interface CraftPanelProps {
  views: RecipeView[];
  disabled: boolean;
  /** 玩家设定的制作目标配方 id（null 表示未设定） */
  goalRecipeId: string | null;
  /** 制作目标是否已经达成 */
  goalCompleted: boolean;
  /** 制作目标的路线推荐（去哪搜材料），无目标时为空 */
  recommendations: CraftGoalRecommendation[];
  /** 设定 / 取消制作目标 */
  onSetGoal: (recipeId: string | null) => void;
  onCraft: (recipeId: string) => void;
}

/** 合成面板：列出全部配方，缺失材料标红；顶部显示制作目标 + 路线推荐 */
export function CraftPanel({
  views,
  disabled,
  goalRecipeId,
  goalCompleted,
  recommendations,
  onSetGoal,
  onCraft,
}: CraftPanelProps): JSX.Element {
  const goalView = views.find((v) => v.recipe.id === goalRecipeId) ?? null;
  return (
    <div className="recipe-list scroll">
      {goalView && (
        <div className={`craft-goal${goalCompleted ? ' done' : ''}`}>
          <div className="cg-head">
            <span className="cg-label">制作目标</span>
            {goalCompleted ? (
              <span className="cg-badge done">已达成</span>
            ) : (
              <span className="cg-badge">进行中</span>
            )}
          </div>
          <div className="cg-name">
            {stackLabel({
              uid: 'goal',
              itemId: goalView.recipe.outputItemId,
              count: goalView.recipe.outputCount,
            })}
          </div>
          <button
            className="btn btn-sm btn-ghost"
            disabled={disabled}
            onClick={() => onSetGoal(null)}
          >
            取消目标
          </button>

          {!goalCompleted && (
            <div className="cg-materials">
              {goalView.recipe.ingredients.map((ing) => {
                const required = ing.count;
                const missingUnit =
                  goalView.missing.find((m) => m.itemId === ing.itemId)?.count ?? 0;
                const held = Math.max(0, required - missingUnit);
                const ok = held >= required;
                return (
                  <span key={ing.itemId} className={`cg-mat${ok ? ' ok' : ' no'}`}>
                    {getItem(ing.itemId).name} {held} / {required}{' '}
                    {ok ? '✓' : '✗'}
                  </span>
                );
              })}
            </div>
          )}

          {!goalCompleted && recommendations.length > 0 && (
            <div className="cg-recs">
              <div className="cg-recs-head">建议搜索区域（仅基于公开物资池）</div>
              <ol className="cg-recs-list">
                {recommendations.slice(0, 3).map((rec) => (
                  <li key={rec.zoneId}>
                    <span className="cg-rec-zone">{getZoneDef(rec.zoneId).name}</span>
                    <span className="cg-rec-detail">
                      可找到：{rec.itemIds.map((id) => getItem(id).name).join('、')}
                    </span>
                    <span className="cg-rec-meta">
                      距离 {rec.distance} · 物资：{rec.supplyLabel}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {views.map(({ recipe, craftable, missing, staminaCost, blockedReason }) => {
        const out = getItem(recipe.outputItemId);
        const missingIds = new Set(missing.map((m) => m.itemId));
        const isGoal = recipe.id === goalRecipeId;
        return (
          <div
            className={`recipe${craftable ? '' : ' locked'}${isGoal ? ' is-goal' : ''}`}
            key={recipe.id}
          >
            <div className="row1">
              <span className="nm">{recipe.name}</span>
              <span className={`tag tag-${out.category}`}>
                {CATEGORY_LABEL[out.category]}
              </span>
            </div>

            <div className="ing">
              {recipe.ingredients.map((ing, i) => {
                const name = getItem(ing.itemId).name;
                const text = `${name}×${ing.count}`;
                return (
                  <span key={ing.itemId}>
                    {i > 0 && ' + '}
                    {missingIds.has(ing.itemId) ? <em>{text}</em> : text}
                  </span>
                );
              })}
              {' → '}
              {out.name}
              {recipe.outputCount > 1 ? `×${recipe.outputCount}` : ''}
            </div>

            <div className="faint mono" style={{ fontSize: 11, marginBottom: 6 }}>
              {itemSummary(out)} · 体力 -{staminaCost}
            </div>

            <div className="recipe-actions">
              <button
                className="btn btn-sm btn-block"
                disabled={disabled || !craftable}
                onClick={() => onCraft(recipe.id)}
              >
                {craftable ? '合成' : (blockedReason ?? '不可合成')}
              </button>
              <button
                className="btn btn-sm btn-ghost"
                disabled={disabled}
                onClick={() => onSetGoal(recipe.id)}
                title="设为当前制作目标"
              >
                {isGoal ? '目标中' : '设为目标'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
