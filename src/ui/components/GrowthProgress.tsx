import { experienceToNextLevel } from '../../core/progression';
import { GAME_CONFIG } from '../../data/gameConfig';
import type { Combatant } from '../../core/types';
import { Bar } from './Bar';

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

  return (
    <div
      className="survival-metric survival-metric-growth"
      data-growth-level={player.level}
      data-growth-capped={capped ? 'true' : 'false'}
    >
      <span className="metric-label">成长 Lv.{player.level}</span>
      {capped ? (
        <div
          className="growth-max-state"
          role="status"
          aria-label={`等级 ${player.level}，已满级`}
        >
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
          aria-valuetext={`Lv.${player.level} ${player.exp}/${nextLevelExp} EXP`}
        >
          <Bar value={player.exp} max={nextLevelExp} kind="growth" />
        </div>
      )}
      {/* 可见文本不带 EXP 后缀：三条状态条共用 139px 宽的槽位，
          带后缀时「0/30 EXP」会溢出并压到相邻的「时间」字段上，
          且阈值升到三位数后会更宽。完整措辞保留在上面的
          aria-valuetext 里，读屏用户不受影响。 */}
      <b>{capped ? '已满级' : `${player.exp}/${nextLevelExp}`}</b>
    </div>
  );
}
