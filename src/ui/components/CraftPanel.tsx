import type { CraftGoalRecommendation } from '../../core/craftGuide';
import type { RecipeView } from '../../core/crafting';
import type { Combatant, GameState } from '../../core/types';
import { getItem } from '../../data/items';
import { getZoneDef } from '../../data/zones';
import { CATEGORY_LABEL, itemSummary, stackLabel } from '../../utils/format';
import type { CraftGoalSuggestion, CraftProgressFeedback } from '../craftPathPresentation';
import { craftPathSummary } from '../craftPathPresentation';
import {
  equipmentComparisonText,
  equipmentHandoffFor,
  shouldPromptCraftEquipment,
} from '../equipmentPresentation';
import { ITEM_CATEGORY_META, presentItem } from '../itemPresentation';
import { VisualImage } from './VisualImage';

interface CraftPanelProps {
  views: RecipeView[];
  state: GameState;
  player: Combatant;
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
  /** 无手动目标时的只读建议；采纳仍由父层派发 SET_CRAFT_GOAL。 */
  suggestion?: CraftGoalSuggestion | null;
  /** 最近一次玩家合成，用于原地显示非阻塞进度反馈。 */
  latestCraftFeedback?: CraftProgressFeedback | null;
  /** 装备交接仍由父层派发正式 EQUIP 命令。 */
  onEquip?: (uid: string) => void;
}

/** 合成面板：列出全部配方，缺失材料标红；顶部显示制作目标 + 路线推荐 */
export function CraftPanel({
  views,
  state,
  player,
  disabled,
  goalRecipeId,
  goalCompleted,
  recommendations,
  onSetGoal,
  onCraft,
  suggestion = null,
  latestCraftFeedback = null,
  onEquip,
}: CraftPanelProps): JSX.Element {
  const goalView = views.find((v) => v.recipe.id === goalRecipeId) ?? null;
  const goalPath = goalView ? craftPathSummary(goalView.recipe.id, state, player) : null;
  const weaponViews = views.filter((view) => getItem(view.recipe.outputItemId).category === 'weapon');
  const craftableWeaponCount = weaponViews.filter((view) => view.craftable).length;
  const craftHandoff = latestCraftFeedback
    ? equipmentHandoffFor(player, latestCraftFeedback.outputItemId)
    : null;
  const canEquipCraftOutput = Boolean(
    shouldPromptCraftEquipment(craftHandoff) && onEquip,
  );
  return (
    <div className="recipe-list scroll">
      <section className="craft-route-guide" data-craft-guidance="weapon-primary-path">
        <div className="craft-route-guide-head">
          <span className="craft-route-guide-icon" aria-hidden="true">⚒</span>
          <strong>武器获取主路径</strong>
          <span className="tag tag-weapon">材料 → 中间部件 → 武器</span>
        </div>
        <p>武器主要靠合成；直接搜索只是低概率补充。先设定目标，缺什么材料与公开来源区域会显示在这里。</p>
        <div className="craft-route-guide-meta">武器配方 {weaponViews.length} 条 · 当前可做 {craftableWeaponCount} 条 · 新物品无正式图时自动使用降级图标</div>
      </section>

      {suggestion && !goalRecipeId && (
        <section className="craft-auto-suggestion" data-craft-auto-suggestion="true">
          <div className="craft-auto-suggestion-head">
            <span className="craft-auto-suggestion-icon" aria-hidden="true">✦</span>
            <strong>下一步建议：{suggestion.name}</strong>
            <span className="tag tag-weapon">攻击 +{suggestion.attack}</span>
          </div>
          <p>{suggestion.reason}</p>
          <div className="craft-auto-suggestion-meta">
            {suggestion.sourceZoneIds.length > 0
              ? `公开来源：${suggestion.sourceZoneIds.slice(0, 3).map((id) => getZoneDef(id).name).join('、')}`
              : '公开来源：请查看图鉴'}
          </div>
          <button
            className="btn btn-sm btn-primary"
            disabled={disabled}
            data-craft-adopt-suggestion="true"
            onClick={() => onSetGoal(suggestion.recipeId)}
          >
            采纳建议并持续追踪
          </button>
        </section>
      )}

      {latestCraftFeedback && (
        <section className="craft-progress-feedback" data-craft-progress-feedback="true">
          <VisualImage
            visual={presentItem(latestCraftFeedback.outputItemId).visual}
            alt={`${getItem(latestCraftFeedback.outputItemId).name}合成反馈图标`}
            className="craft-progress-feedback-visual"
          />
          <div>
            <strong>合成进度已更新</strong>
            <div>{latestCraftFeedback.message}</div>
            {craftHandoff?.status === 'equipped' && (
              <div className="equipment-handoff equipment-handoff-equipped">
                <span aria-hidden="true">✓</span> 成品已装备
              </div>
            )}
            {canEquipCraftOutput && craftHandoff?.candidate && (
              <div className="equipment-handoff">
                <span>是否装备？{equipmentComparisonText(craftHandoff)}</span>
                <button
                  className="btn btn-sm btn-primary"
                  data-craft-equip-output="true"
                  disabled={disabled}
                  onClick={() => onEquip?.(craftHandoff.candidate!.uid)}
                >
                  立即装备
                </button>
              </div>
            )}
          </div>
        </section>
      )}

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
            <VisualImage
              visual={presentItem(goalView.recipe.outputItemId).visual}
              alt={`${getItem(goalView.recipe.outputItemId).name}制作目标图标`}
              className="craft-output-visual craft-goal-output-visual"
            />
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
                    <VisualImage
                      visual={presentItem(ing.itemId).visual}
                      alt={`${getItem(ing.itemId).name}材料图标`}
                      className="craft-material-visual"
                    />
                    {getItem(ing.itemId).name} {held} / {required}{' '}
                    {ok ? '✓' : '✗'}
                  </span>
                );
              })}
            </div>
          )}

          {!goalCompleted && recommendations.length > 0 && (
            <div className="cg-recs">
              <div className="cg-recs-head">建议搜索区域（静态来源 + 已公开物资分档）</div>
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

          {!goalCompleted && goalPath && goalPath.intermediateSteps.length > 0 && (
            <div className="cg-path" data-craft-intermediate-path="true">
              <div className="cg-recs-head">先完成中间部件</div>
              <div className="cg-path-steps">
                {goalPath.intermediateSteps.map((step) => (
                  <span key={step.recipeId} className="cg-path-step">
                    {step.name}
                  </span>
                ))}
              </div>
              <div className="cg-path-depth">路线深度 {goalPath.depth} 层；只显示静态公开配方与来源池。</div>
            </div>
          )}

          {!goalCompleted && goalPath && goalPath.steps.length > 0 && (
            <div className="cg-subgoal-tracker" data-craft-subgoal-tracker="true">
              <div className="cg-recs-head">持续追踪 · 当前子目标</div>
              <div className="cg-subgoal-current">
                <span aria-hidden="true">{goalPath.nextStep ? '→' : '✓'}</span>
                <strong>{goalPath.nextStep?.name ?? '全部步骤已具备，可合成目标'}</strong>
              </div>
              <div className="cg-subgoal-steps">
                {goalPath.steps.map((step) => (
                  <span
                    key={step.recipeId}
                    className={`cg-subgoal-step cg-subgoal-${step.status}`}
                    data-craft-step-status={step.status}
                  >
                    <span aria-hidden="true">{step.status === 'complete' ? '✓' : step.status === 'ready' ? '○' : '!'}</span>
                    {step.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {!goalCompleted && goalPath && goalPath.rawMaterials.length > 0 && (
            <div className="cg-raw-materials" data-craft-raw-materials="true">
              <div className="cg-recs-head">原始材料缺口与公开来源</div>
              {goalPath.rawMaterials.map((material) => (
                <div className="cg-raw-material" key={material.itemId}>
                  <span>
                    {getItem(material.itemId).name} {material.held} / {material.required}
                    {material.missing > 0 ? ` · 缺 ${material.missing}` : ' · 已有'}
                  </span>
                  <span className="cg-rec-meta">
                    {material.sourceZoneIds.length > 0
                      ? `公开来源：${material.sourceZoneIds.map((id) => getZoneDef(id).name).join('、')}`
                      : '暂无公开来源池'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {views.map(({ recipe, craftable, missing, staminaCost, blockedReason }) => {
        const out = getItem(recipe.outputItemId);
        const output = presentItem(recipe.outputItemId);
        const outputMeta = ITEM_CATEGORY_META[out.category];
        const path = craftPathSummary(recipe.id, state, player);
        const missingIds = new Set(missing.map((m) => m.itemId));
        const isGoal = recipe.id === goalRecipeId;
        return (
          <div
            className={`recipe${craftable ? '' : ' locked'}${isGoal ? ' is-goal' : ''}`}
            data-craft-state={craftable ? 'available' : 'blocked'}
            data-output-item-id={recipe.outputItemId}
            key={recipe.id}
          >
            <div className="row1">
              <span className="nm recipe-output-name">
                <VisualImage
                  visual={output.visual}
                  alt={`${out.name}合成结果图标`}
                  className="craft-output-visual"
                />
                {recipe.name}
              </span>
              <span className={`tag tag-${out.category}`}>
                <span aria-hidden="true">{outputMeta.icon}</span> {CATEGORY_LABEL[out.category]}
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
            {path && path.intermediateSteps.length > 0 && (
              <div className="recipe-chain-note" data-craft-depth={path.depth}>
                先做：{path.intermediateSteps.map((step) => step.name).join(' → ')} · {path.depth} 层路线
              </div>
            )}

            <div className={`recipe-state ${craftable ? 'recipe-state-ready' : 'recipe-state-blocked'}`}>
              <span className="recipe-state-icon" aria-hidden="true">{craftable ? '✓' : '!'}</span>
              <span>{craftable ? '可合成' : blockedReason ?? '当前不可合成'}</span>
            </div>
            {!craftable && missing.length > 0 && (
              <div className="recipe-missing" data-missing-materials="true">
                缺少：{missing.map((m) => `${getItem(m.itemId).name}×${m.count}`).join('、')}
              </div>
            )}

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
                aria-label={`${isGoal ? '保持' : '设定'}${recipe.name}为当前制作目标`}
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
