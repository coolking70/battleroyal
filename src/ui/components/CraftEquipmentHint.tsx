import { getItem } from '../../data/items';
import {
  equipmentComparisonText,
  type EquipmentHandoff,
} from '../equipmentPresentation';
import { presentItem } from '../itemPresentation';
import { VisualImage } from './VisualImage';

interface CraftEquipmentHintProps {
  handoff: EquipmentHandoff;
  disabled: boolean;
  onEquip: (uid: string) => void;
  onDismiss: () => void;
}

/**
 * 合成装备后的内联交接提示：只建议，不自动装备，不阻塞其它操作。
 * 成品与比较值均来自玩家自己的物品 / 装备，不读取 NPC 或区域库存。
 */
export function CraftEquipmentHint({
  handoff,
  disabled,
  onEquip,
  onDismiss,
}: CraftEquipmentHintProps): JSX.Element {
  const candidate = handoff.candidate;
  if (!candidate) return <></>;
  const item = getItem(candidate.itemId);
  const presented = presentItem(candidate.itemId, candidate);

  return (
    <aside
      className="craft-equipment-hint"
      data-craft-equipment-hint="true"
      aria-live="polite"
    >
      <VisualImage
        visual={presented.visual}
        alt={`${item.name}装备提示图标`}
        className="craft-equipment-hint-visual"
      />
      <div className="craft-equipment-hint-body">
        <div className="craft-equipment-hint-kicker">合成完成 · 装备提升</div>
        <strong>是否装备「{item.name}」？</strong>
        <div className="craft-equipment-hint-comparison" data-craft-equipment-comparison="true">
          {equipmentComparisonText(handoff)}
        </div>
      </div>
      <div className="craft-equipment-hint-actions">
        <button
          type="button"
          className="btn btn-sm btn-primary"
          data-craft-equipment-hint-equip="true"
          disabled={disabled}
          onClick={() => onEquip(candidate.uid)}
        >
          装备
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          data-craft-equipment-hint-dismiss="true"
          onClick={onDismiss}
          aria-label="忽略合成装备提示"
        >
          忽略
        </button>
      </div>
    </aside>
  );
}
