import type { Combatant, PendingPickup } from '../../core/types';
import { stackLabel } from '../../utils/format';
import { ITEM_CATEGORY_META, stackPresentation } from '../itemPresentation';
import { VisualImage } from './VisualImage';

interface PendingPickupPanelProps {
  pending: PendingPickup;
  player: Combatant;
  onResolve: (accept: boolean, dropUid?: string) => void;
}

/** 背包已满时的取舍面板：换掉某一格，或直接放弃 */
export function PendingPickupPanel({
  pending,
  player,
  onResolve,
}: PendingPickupPanelProps): JSX.Element {
  const pendingItem = stackPresentation(pending.stack);
  const pendingMeta = ITEM_CATEGORY_META[pendingItem.category];

  return (
    <div className="pending" data-pending-item-id={pendingItem.itemId}>
      <h4>背包已满</h4>
      <div className="pending-found">
        <VisualImage
          visual={pendingItem.visual}
          alt={`${pendingItem.name}拾取图标`}
          className="pending-item-visual"
        />
        <div className="dim" style={{ fontSize: 12.5 }}>
          <div><span className="pending-kicker">待处理拾取</span> · <b>{stackLabel(pending.stack)}</b></div>
          <div>{pendingItem.summary} · <span className="tag tag-item-category"><span aria-hidden="true">{pendingMeta.icon}</span> {pendingMeta.label}</span></div>
        </div>
      </div>
      <div className="dim pending-instruction" style={{ fontSize: 12.5 }}>
        选择一件背包物品替换，或者放弃它。
      </div>

      <div className="pending-grid">
        {player.inventory.map((stack) => (
          <button
            className="btn btn-sm"
            key={stack.uid}
            data-replace-item-id={stack.itemId}
            onClick={() => onResolve(true, stack.uid)}
            aria-label={`丢弃 ${stackLabel(stack)}，换取 ${pendingItem.name}`}
          >
            <VisualImage
              visual={stackPresentation(stack).visual}
              alt={`${stackLabel(stack)}图标`}
              className="pending-replace-visual"
            />
            换掉 {stackLabel(stack)}
          </button>
        ))}
      </div>

      <button className="btn btn-sm btn-danger" onClick={() => onResolve(false)}>
        放弃该物品
      </button>
    </div>
  );
}
