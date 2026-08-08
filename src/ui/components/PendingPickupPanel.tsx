import type { Combatant, PendingPickup } from '../../core/types';
import { getItem } from '../../data/items';
import { itemSummary, stackLabel } from '../../utils/format';

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
  const def = getItem(pending.stack.itemId);

  return (
    <div className="pending">
      <h4>背包已满</h4>
      <div className="dim" style={{ fontSize: 12.5 }}>
        发现 <b>{stackLabel(pending.stack)}</b>（{itemSummary(def, pending.stack)}）。
        选择一件背包物品替换，或者放弃它。
      </div>

      <div className="pending-grid">
        {player.inventory.map((stack) => (
          <button
            className="btn btn-sm"
            key={stack.uid}
            onClick={() => onResolve(true, stack.uid)}
            title={`丢弃 ${stackLabel(stack)}，换取 ${def.name}`}
          >
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
