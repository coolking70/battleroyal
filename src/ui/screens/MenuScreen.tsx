import { useState } from 'react';
import { generateRandomSeed } from '../../core/random';
import type { LegacySaveInfo } from '../../core/saveLoad';
import { CHARACTERS } from '../../data/characters';
import { DEFAULT_SEED, GAME_CONFIG, GAME_VERSION } from '../../data/gameConfig';
import { cx, normalizeSeed } from '../../utils/format';
import { getCharacterVisual } from '../visualAssets';
import { VisualImage } from '../components/VisualImage';

interface MenuScreenProps {
  resumable: boolean;
  /** 存在但校验失败的存档错误信息（null 表示没有损坏存档） */
  corruptError: string | null;
  /** 检测到的旧版本（0.1.0）存档，不做静默迁移 */
  legacySaves: LegacySaveInfo[];
  onStart: (seed: string, characterId: string) => void;
  onResume: () => void;
  onDeleteSave: () => void;
  onDeleteLegacy: () => void;
}

/** 主菜单 + 角色选择（合并为一屏，减少无谓跳转） */
export function MenuScreen({
  resumable,
  corruptError,
  legacySaves,
  onStart,
  onResume,
  onDeleteSave,
  onDeleteLegacy,
}: MenuScreenProps): JSX.Element {
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [characterId, setCharacterId] = useState(CHARACTERS[0]?.id ?? 'scout');

  const effectiveSeed = normalizeSeed(seed) || DEFAULT_SEED;

  return (
    <div className="menu">
      <div className="menu-inner">
        <div className="menu-head">
          <h1>区域大逃杀</h1>
          <div className="sub">ZONE BATTLE ROYALE · v{GAME_VERSION} · 单人离线原型</div>
        </div>

        {(corruptError || legacySaves.length > 0) && (
          <div className="panel save-warn">
            {corruptError && (
              <div className="warn-line">
                <span className="warn-ico">⚠</span>
                <span>
                  检测到一份损坏的存档，无法继续：{corruptError}。可以删除后重开。
                </span>
                <button className="btn btn-sm btn-danger" onClick={onDeleteSave}>
                  删除损坏存档
                </button>
              </div>
            )}
            {legacySaves.length > 0 && (
              <div className="warn-line">
                <span className="warn-ico">⚠</span>
                <span>
                  发现 {legacySaves.length} 份旧版本（v
                  {legacySaves.map((l) => l.version ?? '?').join(' / ')}）存档，
                  第二阶段不做自动迁移，建议删除。
                </span>
                <button className="btn btn-sm btn-danger" onClick={onDeleteLegacy}>
                  删除旧存档
                </button>
              </div>
            )}
          </div>
        )}

        <div className="panel menu-brief">
          <b>{GAME_CONFIG.totalContestants}</b> 名参赛者被投放进 6 个互相连通的区域。
          你每做一次行动就推进 <b>1</b> 个时间单位，随后 {GAME_CONFIG.npcCount} 名 NPC
          各自行动。第 <b>{GAME_CONFIG.firstZoneEventTime}</b> 个时间单位起，区域会被逐个封锁，
          预警 <b>{GAME_CONFIG.zoneWarningDuration}</b> 个时间单位后正式成为禁区，
          停留每回合损失 <b>{GAME_CONFIG.zoneDamagePerTick}</b> 点生命。
          <br />
          在搜索、合成、战斗与撤离之间做取舍，活到最后一个。
        </div>

        <div className="panel seed-row">
          <label htmlFor="seed">随机种子</label>
          <input
            id="seed"
            value={seed}
            maxLength={24}
            onChange={(e) => setSeed(e.target.value)}
            placeholder={DEFAULT_SEED}
            spellCheck={false}
          />
          <button className="btn btn-sm" onClick={() => setSeed(generateRandomSeed())}>
            随机
          </button>
          <button className="btn btn-sm" onClick={() => setSeed(DEFAULT_SEED)}>
            默认
          </button>
          <span className="faint mono" style={{ fontSize: 11 }}>
            实际使用：{effectiveSeed}
          </span>
        </div>

        <div className="char-grid">
          {CHARACTERS.map((c) => (
            <button
              key={c.id}
              className={cx('char-card', characterId === c.id && 'selected')}
              onClick={() => setCharacterId(c.id)}
            >
              <div className="char-heading">
                <VisualImage visual={getCharacterVisual(c.id)} alt={`${c.name}头像`} className="char-visual" />
                <h3>{c.name}</h3>
              </div>
              <div className="desc">{c.description}</div>
              <div className="char-stats">
                <span>生命 {c.maxHp}</span>
                <span>体力 {c.maxStamina}</span>
                <span>攻击 {c.attack}</span>
                <span>防御 {c.defense}</span>
                <span>感知 {c.perception}</span>
                <span>速度 {c.speed}</span>
                <span>制作 {c.crafting}</span>
                <span>医疗 {c.medical}</span>
              </div>
              <div className="char-passive">
                {c.passiveName} · <span>{c.passiveDescription}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="menu-actions">
          <button
            className="btn btn-primary"
            onClick={() => onStart(effectiveSeed, characterId)}
          >
            开始新对局
          </button>
          <button className="btn" disabled={!resumable} onClick={onResume}>
            {resumable ? '继续上次对局' : '没有可继续的存档'}
          </button>
          {resumable && (
            <button className="btn btn-ghost" onClick={onDeleteSave}>
              删除存档
            </button>
          )}
        </div>

        <div className="menu-note">
          相同种子 + 相同角色 + 相同操作序列 = 完全相同的一局。进度自动保存在浏览器本地。
          <br />
          在地址栏追加 <b>?debug=1</b> 可打开调试面板。
        </div>
      </div>
    </div>
  );
}
