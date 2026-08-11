import { experienceToNextLevel } from '../../core/progression';
import { GAME_CONFIG } from '../../data/gameConfig';
import type { Combatant } from '../../core/types';

interface GrowthProgressProps {
  player: Combatant;
}

/**
 * 玩家自己的成长状态，嵌入既有 P0 生存资源组。
 * 敌方 Combatant 不会经过这个组件，因此等级 / 经验不会进入遭遇视图。
 */
export function GrowthProgress({ player }: GrowthProgressProps): JSX.Element {
  const capped = player.level >= GAME_CONFIG.maxLevel;
  const nextLevelExp = experienceToNextLevel(player.level);
  const progress = capped || nextLevelExp <= 0
    ? 100
    : Math.min(100, Math.round((player.exp / nextLevelExp) * 100));

  return (
    <div
      className="survival-metric survival-metric-growth"
      data-growth-level={player.level}
      data-growth-capped={capped ? 'true' : 'false'}
    >
      <span className="metric-label">成长</span>
      {capped ? (
        <div
          className="growth-max-state"
          role="status"
          aria-label={`等级 ${player.level}，已满级`}
        >
          <b>Lv.{player.level}</b>
          <span>已满级</span>
        </div>
      ) : (
        <div
          className="growth-progress-wrap"
          role="progressbar"
          aria-label={`等级 ${player.level} 经验进度`}
          aria-valuemin={0}
          aria-valuemax={nextLevelExp}
          aria-valuenow={player.exp}
        >
          <div className="growth-progress-track" aria-hidden="true">
            <i style={{ width: `${progress}%` }} />
          </div>
          <span className="growth-progress-copy">
            <b>Lv.{player.level}</b>
            <span>{player.exp}/{nextLevelExp} EXP</span>
          </span>
        </div>
      )}
    </div>
  );
}
