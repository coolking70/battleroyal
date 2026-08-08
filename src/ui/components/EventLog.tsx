import { useEffect, useRef } from 'react';
import type { GameEvent, GameEventType } from '../../core/types';
import { cx } from '../../utils/format';

interface EventLogProps {
  events: GameEvent[];
  playerId: string;
}

/** 事件类型 -> 着色分类 */
function kindOf(type: GameEventType): string {
  switch (type) {
    case 'ATTACK_HIT':
    case 'ATTACK_MISSED':
      return 'k-attack';
    case 'CHARACTER_DIED':
    case 'GAME_ENDED':
      return 'k-death';
    case 'ZONE_WARNING':
    case 'ZONE_RESTRICTED':
    case 'ZONE_DAMAGE':
      return 'k-zone';
    case 'ITEM_FOUND':
    case 'ITEM_CRAFTED':
    case 'ITEM_PICKED':
    case 'ITEM_USED':
    case 'ITEM_EQUIPPED':
      return 'k-item';
    default:
      return '';
  }
}

/** 右栏日志：自动滚到底部，玩家自身事件高亮 */
export function EventLog({ events, playerId }: EventLogProps): JSX.Element {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events]);

  if (events.length === 0) {
    return <div className="empty">暂无记录。</div>;
  }

  return (
    <div className="log-list scroll" ref={boxRef}>
      {events.map((e) => (
        <div
          key={e.id}
          className={cx('log-line', kindOf(e.type), e.actorId === playerId && 'k-self')}
        >
          <span className="t">{e.time}</span>
          <span className="m">{e.message}</span>
        </div>
      ))}
    </div>
  );
}
