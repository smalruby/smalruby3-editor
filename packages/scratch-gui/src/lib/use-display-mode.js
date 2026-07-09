import { useEffect, useState } from 'react';
import { DISPLAY_MODE_CHANGED_EVENT, detectDisplayMode } from './settings/display-mode/persistence.js';

/**
 * 現在の表示モード設定 (`auto` / `desktop` / `mobile`) を返す hook (Issue #865)。
 *
 * localStorage の値を読み、`persistDisplayMode` が発火する
 * `smalruby:displayModeChanged` イベント (同一タブ) と `storage` イベント
 * (他タブ) の両方を購読してリアルタイムに追従する。
 * @returns {string} DISPLAY_MODE_AUTO | DISPLAY_MODE_DESKTOP | DISPLAY_MODE_MOBILE
 */
const useDisplayMode = () => {
    const [mode, setMode] = useState(detectDisplayMode);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return () => {};
        }
        const handler = () => setMode(detectDisplayMode());
        window.addEventListener(DISPLAY_MODE_CHANGED_EVENT, handler);
        window.addEventListener('storage', handler);
        // マウント時点で他所が既に書き換えている可能性があるので同期しておく。
        handler();
        return () => {
            window.removeEventListener(DISPLAY_MODE_CHANGED_EVENT, handler);
            window.removeEventListener('storage', handler);
        };
    }, []);

    return mode;
};

export default useDisplayMode;
