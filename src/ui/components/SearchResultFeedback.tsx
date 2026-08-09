import type { SearchFeedback } from '../searchPresentation';
import { ITEM_CATEGORY_META, presentItem } from '../itemPresentation';
import type { Combatant } from '../../core/types';
import { equipmentHandoffFor } from '../equipmentPresentation';
import { VisualImage } from './VisualImage';

interface SearchResultFeedbackProps {
  feedback: SearchFeedback;
  /** 仅用于玩家自己的装备交接，不读取其他角色状态。 */
  player?: Combatant;
  onEquip?: (uid: string) => void;
}

/** 搜索结果的非阻塞原地焦点；遭遇结果由 EncounterPanel 接管视觉焦点。 */
export function SearchResultFeedback({ feedback, player, onEquip }: SearchResultFeedbackProps): JSX.Element | null {
  if (feedback.kind === 'encounter') return null;

  if (feedback.kind === 'nothing') {
    return (
      <aside
        className="search-result search-result-empty"
        data-search-result="nothing"
        aria-live="polite"
      >
        <span className="search-result-icon" aria-hidden="true">∅</span>
        <div>
          <div className="search-result-kicker">SEARCH RESULT · LEVEL 1</div>
          <strong>{feedback.exhausted ? '区域已搜空' : '没有找到可用物品'}</strong>
          <div className="search-result-note">
            {feedback.exhausted ? '这里暂时没有新的物资可拾取。' : '这次搜索没有带回物品。'}
          </div>
          {feedback.modifiers.length > 0 && (
            <div className="search-result-modifiers">{feedback.modifiers.join(' · ')}</div>
          )}
        </div>
      </aside>
    );
  }

  const item = presentItem(feedback.itemId);
  const categoryMeta = ITEM_CATEGORY_META[item.category];
  const handoff = !feedback.pending && player ? equipmentHandoffFor(player, item.itemId) : null;
  const canQuickEquip = Boolean(handoff?.candidate && handoff.status !== 'equipped' && onEquip);
  return (
    <aside
      className="search-result search-result-item"
      data-search-result="item"
      data-item-id={item.itemId}
      aria-live="polite"
    >
      <VisualImage
        visual={item.visual}
        alt={`${item.name}搜索结果图标`}
        className="search-result-item-visual"
      />
      <div className="search-result-body">
        <div className="search-result-kicker">SEARCH RESULT · LEVEL 2</div>
        <div className="search-result-title-row">
          <strong>发现 {item.name}</strong>
          <span className="tag tag-item-category">
            <span aria-hidden="true">{categoryMeta.icon}</span> {item.categoryLabel}
          </span>
        </div>
        <div className="search-result-meta">{item.quantityLabel} · {item.summary}</div>
        <div className="search-result-destination">
          <span className="search-result-cue" aria-hidden="true">{feedback.pending ? '!' : '✓'}</span>
          {feedback.pending ? '背包已满：等待处理拾取' : '已收入背包'}
        </div>
        {feedback.modifiers.length > 0 && (
          <div className="search-result-modifiers">{feedback.modifiers.join(' · ')}</div>
        )}
        {handoff?.status === 'equipped' && (
          <div className="equipment-handoff equipment-handoff-equipped">
            <span aria-hidden="true">✓</span> 已装备 · {handoff.slot === 'weapon' ? '武器位' : '防具位'}
          </div>
        )}
        {canQuickEquip && handoff?.candidate && (
          <div className="equipment-handoff">
            <span>{handoff.status === 'ready' ? '装备位可升级' : '可作为备用装备'}</span>
            <button
              className="btn btn-sm btn-primary"
              data-search-equip-output="true"
              onClick={() => onEquip?.(handoff.candidate!.uid)}
            >
              装备
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
