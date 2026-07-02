import {DISPLAY_MODE_AUTO, DISPLAY_MODE_DESKTOP, DISPLAY_MODE_MOBILE} from '.';

const STORAGE_KEY = 'smalruby:displayMode';

/**
 * 表示モードが変わったことを同一タブ内に伝えるカスタムイベント名。
 * `ResponsiveGui` はこれを購読して MobileGui / desktop GUI を切り替える。
 * (localStorage の `storage` イベントは他タブにしか飛ばないため、同一タブ用に
 *  独自イベントを使う。)
 */
const DISPLAY_MODE_CHANGED_EVENT = 'smalruby:displayModeChanged';

const isValidDisplayMode = mode =>
    [DISPLAY_MODE_AUTO, DISPLAY_MODE_DESKTOP, DISPLAY_MODE_MOBILE].includes(mode);

/**
 * localStorage から現在の表示モード設定を読む。未設定 / 不正値なら `auto`。
 * @returns {string} DISPLAY_MODE_AUTO | DISPLAY_MODE_DESKTOP | DISPLAY_MODE_MOBILE
 */
const detectDisplayMode = () => {
    if (typeof window === 'undefined' || !window.localStorage) {
        return DISPLAY_MODE_AUTO;
    }
    const mode = window.localStorage.getItem(STORAGE_KEY);
    return isValidDisplayMode(mode) ? mode : DISPLAY_MODE_AUTO;
};

/**
 * 表示モード設定を localStorage に保存し、同一タブへ変更イベントを飛ばす。
 * `auto` は「設定なし」と等価なのでキーを削除する。
 * @param {string} mode - 保存する表示モード
 */
const persistDisplayMode = mode => {
    if (!isValidDisplayMode(mode)) {
        throw new Error(`Invalid display mode: ${mode}`);
    }
    if (typeof window === 'undefined' || !window.localStorage) {
        return;
    }
    if (mode === DISPLAY_MODE_AUTO) {
        window.localStorage.removeItem(STORAGE_KEY);
    } else {
        window.localStorage.setItem(STORAGE_KEY, mode);
    }
    if (typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new Event(DISPLAY_MODE_CHANGED_EVENT));
    }
};

export {
    STORAGE_KEY,
    DISPLAY_MODE_CHANGED_EVENT,
    isValidDisplayMode,
    detectDisplayMode,
    persistDisplayMode
};
