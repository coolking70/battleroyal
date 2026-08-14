import type { CSSProperties } from 'react';
import type { Combatant, GameState, Recipe } from '../../core/types';
import { getItem } from '../../data/items';
import { RECIPES, recipeVisibility, tryGetRecipe } from '../../data/recipes';
import { getZoneDef } from '../../data/zones';
import { getLandmarkDef } from '../../data/landmarks';
import { getWildEnemy } from '../../data/wildEnemies';
import { worldSourcesForItem } from '../../core/worldSources';
import { CATEGORY_LABEL, itemSummary } from '../../utils/format';
import {
  craftPathSummary,
  publicSourceZones,
  publicSourceLandmarks,
  rawMaterialIdsForRecipe,
} from '../craftPathPresentation';
import { ITEM_CATEGORY_META, presentItem } from '../itemPresentation';
import { VisualImage } from './VisualImage';

interface CraftingCodexProps {
  state: GameState;
  player: Combatant;
  disabled: boolean;
  onSetGoal: (recipeId: string) => void;
}

const STATUS_LABEL = {
  complete: '已有成品',
  ready: '当前可做',
  blocked: '等待材料',
} as const;

function visibleRecipes(): Recipe[] {
  return RECIPES.filter((recipe) => recipeVisibility(recipe.id) === 'visible');
}

/**
 * 公开合成图鉴：静态配方关系与当前 actor plan 分层展示。
 * 静态来源只读公开配方/区域池；当前状态、数量和 readiness 只消费
 * craftPathSummary -> buildCraftPlan，不再在 Codex 内递归制作路线。
 */
export function CraftingCodex({
  state,
  player,
  disabled,
  onSetGoal,
}: CraftingCodexProps): JSX.Element {
  const recipes = visibleRecipes();
  return (
    <div className="craft-codex scroll" data-craft-codex="true">
      <section className="craft-codex-intro">
        <div className="craft-codex-title">
          <span aria-hidden="true">⌘</span>
          <strong>公开合成图鉴</strong>
          <span className="tag">{recipes.length} 条公开配方</span>
        </div>
        <p>完整依赖关系与材料静态来源随时可查。状态只反映你的物品，不显示区域实际库存。</p>
      </section>

      <div className="craft-codex-tree" role="list" aria-label="公开合成依赖树">
        {recipes.map((recipe) => {
          const path = craftPathSummary(recipe.id, state, player);
          const output = getItem(recipe.outputItemId);
          const outputPresentation = presentItem(recipe.outputItemId);
          const categoryMeta = ITEM_CATEGORY_META[output.category];
          const rawIds = rawMaterialIdsForRecipe(recipe.id);
          return (
            <article
              className="craft-codex-root"
              data-codex-root-id={recipe.id}
              key={recipe.id}
              role="listitem"
            >
              <div className="craft-codex-root-head">
                <VisualImage
                  visual={outputPresentation.visual}
                  alt={`${output.name}图鉴图标`}
                  className="craft-codex-visual"
                />
                <div className="craft-codex-root-name">
                  <strong>{recipe.name}</strong>
                  <span className={`tag tag-${output.category}`}>
                    <span aria-hidden="true">{categoryMeta.icon}</span> {CATEGORY_LABEL[output.category]}
                  </span>
                  <div className="craft-codex-summary">{itemSummary(output)}</div>
                </div>
                <button
                  className="btn btn-sm btn-ghost"
                  disabled={disabled}
                  onClick={() => onSetGoal(recipe.id)}
                >
                  设为目标
                </button>
              </div>

              <div className="craft-codex-relation">
                {recipe.ingredients.map((ingredient, index) => (
                  <span key={ingredient.itemId}>
                    {index > 0 && ' + '}
                    {getItem(ingredient.itemId).name}×{ingredient.count}
                  </span>
                ))}
                <span aria-hidden="true"> → </span>
                <strong>{output.name}</strong>
              </div>

              {path && path.steps.length > 0 && (
                <div className="craft-codex-steps" aria-label={`${recipe.name}依赖步骤`}>
                  <div className="craft-codex-step-recipe">当前路线需求（共享部件按数量合并）</div>
                  {path.steps.map((step) => {
                    const stepRecipe = tryGetRecipe(step.recipeId);
                    return (
                      <div
                        className={`craft-codex-step craft-codex-step-${step.status}`}
                        data-codex-depth={step.depth}
                        data-codex-step-id={step.recipeId}
                        data-codex-required={step.required}
                        key={step.recipeId}
                        style={{ '--codex-depth': step.depth } as CSSProperties}
                      >
                        <span className="craft-codex-step-marker" aria-hidden="true">
                          {step.status === 'complete' ? '✓' : step.status === 'ready' ? '○' : '!'}
                        </span>
                        <strong>{step.name}{step.required > 1 ? ` ×${step.required}` : ''}</strong>
                        <span className="craft-codex-step-depth">第 {step.depth} 层 · {STATUS_LABEL[step.status]}</span>
                        {stepRecipe && (
                          <span className="craft-codex-step-recipe">
                            {stepRecipe.ingredients.map((ingredient) => getItem(ingredient.itemId).name).join(' + ')}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {path && (
                <div className="craft-codex-gaps">
                  <strong>{path.rawMaterials.length > 0 ? '当前缺口：' : '当前原始材料：已齐或可由前置步骤获得'}</strong>
                  {path.rawMaterials.length > 0 && (
                    <span>
                      {path.rawMaterials
                        .filter((material) => material.missing > 0)
                        .map((material) => `${getItem(material.itemId).name}×${material.missing}`)
                        .join('、')}
                    </span>
                  )}
                </div>
              )}

              <div className="craft-codex-sources">
                {rawIds.map((itemId) => {
                  const sourceIds = publicSourceZones(itemId);
                  const wildSources = worldSourcesForItem(itemId).filter((source) => source.kind === 'wild_drop');
                  const enemyNames = wildSources.flatMap((source) => source.enemyIds).filter((id, index, all) => all.indexOf(id) === index).map((id) => getWildEnemy(id).name);
                  return (
                    <span className="craft-codex-source" key={itemId}>
                      {getItem(itemId).name}：{sourceIds.length > 0
                        ? sourceIds.map((id) => getZoneDef(id).name).join('、')
                        : '暂无公开来源池'}
                      {publicSourceLandmarks(itemId).length > 0
                        ? `；地标来源：${publicSourceLandmarks(itemId).map((id) => getLandmarkDef(id).name).join('、')}`
                        : ''}
                      {enemyNames.length > 0 ? `；来源敌人：${enemyNames.join('、')}（常见区域，实际个体与掉落未知）` : ''}
                    </span>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
