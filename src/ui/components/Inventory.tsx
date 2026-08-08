import { GAME_CONFIG } from '../../data/gameConfig';
import { getItem } from '../../data/items';
import { getEquippedArmor, getEquippedWeapon } from '../../core/inventory';
import type { Combatant, ItemStack } from '../../core/types';
import { CATEGORY_LABEL, itemSummary, stackLabel } from '../../utils/format';

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
  onUnequip,
  disabled,
}: {
  label: string;
  stack: ItemStack | null;
  onUnequip: () => void;
  disabled: boolean;
}): JSX.Element {
  const def = stack ? getItem(stack.itemId) : null;
  return (
    <div className="equip-slot">
      <div className="lbl">{label}</div>
      <div className="nm">{def ? def.name : <span className="faint">空</span>}</div>
      <div className="meta">{def ? itemSummary(def, stack ?? undefined) : '—'}</div>
      {def && (
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

  return (
    <>
      <div className="equip-row">
        <EquipSlot
          label="武器"
          stack={weapon}
          disabled={disabled}
          onUnequip={() => onUnequip('weapon')}
        />
        <EquipSlot
          label="防具"
          stack={armor}
          disabled={disabled}
          onUnequip={() => onUnequip('armor')}
        />
      </div>

      <div className="inv-list scroll">
        <div className="faint mono" style={{ fontSize: 11, padding: '0 2px 2px' }}>
          背包 {player.inventory.length}/{GAME_CONFIG.inventorySlots}
        </div>

        {player.inventory.length === 0 && <div className="empty">背包是空的。</div>}

        {player.inventory.map((stack) => {
          const def = getItem(stack.itemId);
          const equipable = def.category === 'weapon' || def.category === 'armor';
          const usable = def.category === 'consumable';
          return (
            <div className="inv-item" key={stack.uid}>
              <div className="row1">
                <span className="nm">{stackLabel(stack)}</span>
                <span className={`tag tag-${def.category}`}>
                  {CATEGORY_LABEL[def.category]}
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
                  title="丢到当前区域地面"
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
