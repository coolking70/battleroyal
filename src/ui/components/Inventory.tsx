import { GAME_CONFIG } from '../../data/gameConfig';
import { getItem } from '../../data/items';
import { getEquippedArmor, getEquippedWeapon } from '../../core/inventory';
import type { Combatant, ItemStack } from '../../core/types';
import { CATEGORY_LABEL, itemSummary, stackLabel } from '../../utils/format';
import { bestInventoryEquipment } from '../equipmentPresentation';
import { ITEM_CATEGORY_META, presentItem, stackPresentation } from '../itemPresentation';
import { VisualImage } from './VisualImage';

interface InventoryProps {
  player: Combatant;
  /** 遭遇战中仍可使用消耗品与装备，但不允许丢弃以外的干扰操作 */
  disabled: boolean;
  onUse: (uid: string) => void;
  onEquip: (uid: string) => void;
  onUnequip: (slot: 'weapon' | 'armor') => void;
  onDrop: (uid: string) => void;
}

function EquipSlot({
  label,
  stack,
  candidate,
  onUnequip,
  disabled,
}: {
  label: string;
  stack: ItemStack | null;
  candidate: ItemStack | null;
  onUnequip: () => void;
  disabled: boolean;
}): JSX.Element {
  const presented = stack ? stackPresentation(stack) : null;
  const candidatePresented = candidate ? stackPresentation(candidate) : null;
  return (
    <div className="equip-slot" data-slot={label} data-equipped={presented ? 'true' : 'false'}>
      <div className="lbl"><span aria-hidden="true">{label === '武器' ? '⚔' : '▣'}</span> {label}</div>
      {presented ? (
        <div className="equip-item-main">
          <VisualImage
            visual={presented.visual}
            alt={`${presented.name}装备图标`}
            className="equip-item-visual"
          />
          <div className="nm">{presented.name}</div>
        </div>
      ) : (
        <div className="equip-empty">
          <div className="nm"><span className="faint">未装备</span></div>
        </div>
      )}
      {presented && <div className="meta">{presented.summary}</div>}
      {!presented && candidatePresented && (
        <div className="equip-candidate" data-candidate-item-id={candidatePresented.itemId}>
          <VisualImage
            visual={candidatePresented.visual}
            alt={`${candidatePresented.name}候选图标`}
            className="equip-candidate-visual"
          />
          <span>候选：{candidatePresented.name}</span>
        </div>
      )}
      {presented && (
        <button
          className="btn btn-sm"
          style={{ marginTop: 6 }}
          disabled={disabled}
          onClick={onUnequip}
        >
          卸下
        </button>
      )}
    </div>
  );
}

/** 背包面板：装备槽 + 8 格物品列表 */
export function Inventory({
  player,
  disabled,
  onUse,
  onEquip,
  onUnequip,
  onDrop,
}: InventoryProps): JSX.Element {
  const weapon = getEquippedWeapon(player);
  const armor = getEquippedArmor(player);
  const weaponCandidate = bestInventoryEquipment(player, 'weapon');
  const armorCandidate = bestInventoryEquipment(player, 'armor');

  return (
    <>
      <div className="equip-row">
        <EquipSlot
          label="武器"
          stack={weapon}
          candidate={weaponCandidate}
          disabled={disabled}
          onUnequip={() => onUnequip('weapon')}
        />
        <EquipSlot
          label="防具"
          stack={armor}
          candidate={armorCandidate}
          disabled={disabled}
          onUnequip={() => onUnequip('armor')}
        />
      </div>

      <div className="inv-list scroll">
        <div className="faint mono" style={{ fontSize: 11, padding: '0 2px 2px' }}>
          背包 {player.inventory.length}/{GAME_CONFIG.inventorySlots}
        </div>

        {player.inventory.map((stack) => {
          const def = getItem(stack.itemId);
          const presented = presentItem(stack.itemId, stack);
          const categoryMeta = ITEM_CATEGORY_META[def.category];
          const equipable = def.category === 'weapon' || def.category === 'armor';
          const usable = def.category === 'consumable';
          return (
            <div className="inv-item" key={stack.uid} data-item-id={stack.itemId}>
              <div className="row1">
                <span className="nm">
                  <VisualImage visual={presented.visual} alt={`${def.name}图标`} className="item-visual" />{' '}
                  {stackLabel(stack)}
                </span>
                <span className={`tag tag-${def.category}`}>
                  <span aria-hidden="true">{categoryMeta.icon}</span> {CATEGORY_LABEL[def.category]}
                </span>
              </div>
              <div className="meta">{itemSummary(def, stack)}</div>
              <div className="ops">
                {usable && (
                  <button
                    className="btn btn-sm"
                    disabled={disabled}
                    onClick={() => onUse(stack.uid)}
                  >
                    使用
                  </button>
                )}
                {equipable && (
                  <button
                    className="btn btn-sm"
                    disabled={disabled}
                    onClick={() => onEquip(stack.uid)}
                  >
                    装备
                  </button>
                )}
                <button
                  className="btn btn-sm"
                  disabled={disabled}
                  onClick={() => onDrop(stack.uid)}
                  aria-label={`丢弃${stackLabel(stack)}到当前区域地面`}
                >
                  丢弃
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
