import { useEffect, useMemo, useState } from 'react';
import { getPlayer } from './core/gameState';
import {
  clearLegacySaves,
  clearSave,
  findLegacySaves,
  hasAnySave,
  loadGame,
  type LegacySaveInfo,
} from './core/saveLoad';
import { DebugPanel } from './ui/components/DebugPanel';
import { Toast } from './ui/components/Toast';
import { GameScreen } from './ui/screens/GameScreen';
import { MenuScreen } from './ui/screens/MenuScreen';
import { ResultScreen } from './ui/screens/ResultScreen';
import { useGame } from './utils/useGame';

declare global {
  interface Window {
    render_game_to_text?: () => string;
  }
}

/** 是否开启调试模式：URL 带 ?debug=1 */
function readDebugFlag(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('debug') === '1';
  } catch {
    return false;
  }
}

interface MenuInfo {
  resumable: boolean;
  corruptError: string | null;
  legacy: LegacySaveInfo[];
}

/**
 * 探测本地存档状态。
 * - 可继续：存在一份合法的、未结束的存档；
 * - 损坏：存在内容但校验失败（提示删除，不做静默迁移）；
 * - 旧版本：发现 0.1.0 遗留存档（同样提示删除）。
 */
function inspectSave(): MenuInfo {
  const legacy = findLegacySaves();
  const res = loadGame();
  if (res.ok) {
    return {
      resumable: res.data.state.status === 'playing',
      corruptError: null,
      legacy,
    };
  }
  const corrupt = hasAnySave();
  return {
    resumable: false,
    corruptError: corrupt ? res.error : null,
    legacy,
  };
}

export default function App(): JSX.Element {
  const { state, toast, saveError, start, resume, dispatch, quit, dismissToast } =
    useGame();
  const debug = useMemo(readDebugFlag, []);
  const [menuInfo, setMenuInfo] = useState<MenuInfo>(() => inspectSave());

  // 回到菜单时重新检测存档（进对局后不需要再查）
  useEffect(() => {
    if (state) return;
    setMenuInfo(inspectSave());
  }, [state]);

  // 给自动化试玩与调试提供紧凑的可读状态；React UI 不依赖 canvas，
  // 因此这里直接暴露当前菜单 / 对局状态而不伪造渲染坐标。
  useEffect(() => {
    window.render_game_to_text = () => {
      if (!state) return JSON.stringify({ mode: 'menu' });
      const player = getPlayer(state);
      return JSON.stringify({
        mode: state.status,
        time: state.time,
        player: {
          id: player.id,
          characterId: player.characterId,
          zoneId: player.currentZoneId,
          hp: player.hp,
          maxHp: player.maxHp,
          stamina: player.stamina,
          level: player.level,
          exp: player.exp,
          attack: player.attack,
          defense: player.defense,
          alive: player.alive,
        },
        encounter: state.encounter
          ? { enemyId: state.encounter.enemyId, resolved: state.encounter.resolved }
          : null,
        activeWorldEvents: state.activeWorldEvents.map((event) => ({
          id: event.eventId,
          zoneId: event.zoneId,
          remaining: event.remaining,
        })),
      });
    };
    return () => {
      delete window.render_game_to_text;
    };
  }, [state]);

  const handleDeleteSave = (): void => {
    clearSave();
    setMenuInfo(inspectSave());
  };

  const handleDeleteLegacy = (): void => {
    clearLegacySaves();
    setMenuInfo(inspectSave());
  };

  if (!state) {
    return (
      <div className="app">
        <MenuScreen
          resumable={menuInfo.resumable}
          corruptError={menuInfo.corruptError}
          legacySaves={menuInfo.legacy}
          onStart={start}
          onResume={resume}
          onDeleteSave={handleDeleteSave}
          onDeleteLegacy={handleDeleteLegacy}
        />
        {toast && <Toast toast={toast} onDismiss={dismissToast} />}
      </div>
    );
  }

  const player = getPlayer(state);
  const finished = state.status !== 'playing';

  return (
    <div className="app">
      {finished ? (
        <ResultScreen
          state={state}
          player={player}
          onRestart={() => start(state.seed, player.characterId)}
          onBackToMenu={quit}
        />
      ) : (
        <GameScreen state={state} player={player} dispatch={dispatch} onQuit={quit} />
      )}

      {debug && (
        <DebugPanel state={state} saveError={saveError} onCommand={dispatch} />
      )}
      {toast && <Toast toast={toast} onDismiss={dismissToast} />}
    </div>
  );
}
