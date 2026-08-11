import { useCallback, useEffect, useRef, useState } from 'react';
import { executeCommand } from '../core/gameEngine';
import { createGame, getPlayer } from '../core/gameState';
import { clearSave, loadGame, saveGame } from '../core/saveLoad';
import type { Command, GameState } from '../core/types';
import { growthFeedbackText } from './growthPresentation';

export interface Toast {
  id: number;
  text: string;
  tone: 'ok' | 'error';
}

export interface UseGameApi {
  state: GameState | null;
  toast: Toast | null;
  saveError: string | null;
  start: (seed: string, characterId: string) => void;
  resume: () => boolean;
  dispatch: (command: Command) => void;
  quit: () => void;
  dismissToast: () => void;
}

/**
 * 把纯函数核心接到 React 上。
 *
 * 这里是 UI 与 core 之间唯一的胶水层：
 * - 所有状态变更都通过 executeCommand 完成
 * - 每次状态变化后自动写入 localStorage
 * - core 不知道 React 的存在，React 也不直接修改 GameState
 */
export function useGame(): UseGameApi {
  const [state, setState] = useState<GameState | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const toastSeq = useRef(0);

  const notify = useCallback((text: string | null, tone: 'ok' | 'error') => {
    if (!text) return;
    toastSeq.current += 1;
    setToast({ id: toastSeq.current, text, tone });
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  // 自动存档：状态每次变化后写入本地存储
  useEffect(() => {
    if (!state) return;
    const res = saveGame(state);
    setSaveError(res.ok ? null : res.error);
  }, [state]);

  // Toast 自动消失
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const start = useCallback((seed: string, characterId: string) => {
    const fresh = createGame({ seed, playerCharacterId: characterId });
    setState(fresh);
    setToast(null);
  }, []);

  const resume = useCallback((): boolean => {
    const res = loadGame();
    if (!res.ok) {
      notify(res.error, 'error');
      return false;
    }
    setState(res.data.state);
    return true;
  }, [notify]);

  const dispatch = useCallback(
    (command: Command) => {
      setState((prev) => {
        if (!prev) return prev;
        const result = executeCommand(prev, command);
        notify(
          growthFeedbackText({
            command,
            before: getPlayer(prev),
            after: getPlayer(result.state),
            message: result.message,
            ok: result.ok,
          }),
          result.ok ? 'ok' : 'error',
        );
        return result.state;
      });
    },
    [notify],
  );

  const quit = useCallback(() => {
    clearSave();
    setState(null);
    setToast(null);
  }, []);

  return { state, toast, saveError, start, resume, dispatch, quit, dismissToast };
}
