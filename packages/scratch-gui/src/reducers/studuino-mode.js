// Studuino モードの GUI の状態（#2213）。設定の正は VM（runtime.extensionStorage・#2212）で、
// ここはその写し（containers/studuino-mode-sync.jsx が VM のイベントで更新する）と、画面だけの状態を持つ。
import { defaultSettings } from '@smalruby/scratch-vm/src/extensions/scratch3_smalrubot_s1/studuino-settings';
import { isStuduinoModeSettings } from '../lib/studuino-mode';

const SET_SETTINGS = 'scratch-gui/studuino-mode/SET_SETTINGS';
const OPEN_PORT_SETTINGS = 'scratch-gui/studuino-mode/OPEN_PORT_SETTINGS';
const CLOSE_PORT_SETTINGS = 'scratch-gui/studuino-mode/CLOSE_PORT_SETTINGS';
const SET_PENDING_SETTINGS = 'scratch-gui/studuino-mode/SET_PENDING_SETTINGS';
const OPEN_SWITCH_DIALOG = 'scratch-gui/studuino-mode/OPEN_SWITCH_DIALOG';
const CLOSE_SWITCH_DIALOG = 'scratch-gui/studuino-mode/CLOSE_SWITCH_DIALOG';

const initialState = {
    // VM の getStuduinoSettings の写し（mode・ports・calibration・unknownVersion）
    settings: defaultSettings(),
    // 入出力の設定のモーダル（#2215）を開いているか
    portSettingsVisible: false,
    // 「すべて消して切り替える」（#2214・S11）で新規の作品を読みこんだあとに入れる設定（無ければ null）
    pendingSettings: null,
    // 切り替えられないときのダイアログ（#2214・S11）: { toStuduino, blocks } か null
    switchDialog: null,
};

const reducer = (state, action) => {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
        case SET_SETTINGS:
            return { ...state, settings: action.settings || defaultSettings() };
        case OPEN_PORT_SETTINGS:
            return { ...state, portSettingsVisible: true };
        case CLOSE_PORT_SETTINGS:
            return { ...state, portSettingsVisible: false };
        case OPEN_SWITCH_DIALOG:
            return { ...state, switchDialog: { toStuduino: action.toStuduino, blocks: action.blocks } };
        case CLOSE_SWITCH_DIALOG:
            return { ...state, switchDialog: null };
        case SET_PENDING_SETTINGS:
            return { ...state, pendingSettings: action.settings || null };
        default:
            return state;
    }
};

/**
 * VM の設定の写しを入れる。
 * @param {object} settings - getStuduinoSettings の戻り値。
 * @returns {object} action
 */
const setStuduinoModeSettings = (settings) => ({ type: SET_SETTINGS, settings });

/**
 * Studuino の設定（ポート・補正値を含む）。
 * @param {object} state - redux の state。
 * @returns {object} 設定。
 */
// state を部分だけ持つ（テストのにせものの store など）ときも落ちないように、無ければ既定の設定
const getStuduinoModeSettings = (state) =>
    (state.scratchGui.studuinoMode && state.scratchGui.studuinoMode.settings) || initialState.settings;

/**
 * Studuino モードか（GUI のどこからでもこれで判定する。緑の旗＝書きこみ・停止＝中断（#2219）もこれを見る）。
 * @param {object} state - redux の state。
 * @returns {boolean} Studuino モードなら true。
 */
const isStuduinoMode = (state) => isStuduinoModeSettings(getStuduinoModeSettings(state));

/**
 * 入出力の設定のモーダルを開く。
 * @returns {object} action
 */
const openStuduinoPortSettings = () => ({ type: OPEN_PORT_SETTINGS });

/**
 * 入出力の設定のモーダルを閉じる。
 * @returns {object} action
 */
const closeStuduinoPortSettings = () => ({ type: CLOSE_PORT_SETTINGS });

/**
 * 入出力の設定のモーダルを開いているか。
 * @param {object} state - redux の state。
 * @returns {boolean} 開いていれば true。
 */
const isStuduinoPortSettingsVisible = (state) =>
    Boolean(state.scratchGui.studuinoMode && state.scratchGui.studuinoMode.portSettingsVisible);

/**
 * 新規の作品を読みこんだあとに入れる設定を覚える（null で消す）。
 * @param {?object} settings - 入れる設定。
 * @returns {object} action
 */
const setStuduinoPendingSettings = (settings) => ({ type: SET_PENDING_SETTINGS, settings });

/**
 * 新規の作品を読みこんだあとに入れる設定。
 * @param {object} state - redux の state。
 * @returns {?object} 設定（無ければ null）。
 */
const getStuduinoPendingSettings = (state) =>
    (state.scratchGui.studuinoMode && state.scratchGui.studuinoMode.pendingSettings) || null;

/**
 * 切り替えられないときのダイアログを開く。
 * @param {boolean} toStuduino - Studuino モードに入ろうとしたなら true。
 * @param {Array<object>} blocks - 止める理由のブロック（lib/studuino-mode-check.js の checkModeSwitch）。
 * @returns {object} action
 */
const openStuduinoSwitchDialog = (toStuduino, blocks) => ({ type: OPEN_SWITCH_DIALOG, toStuduino, blocks });

/**
 * 切り替えられないときのダイアログを閉じる。
 * @returns {object} action
 */
const closeStuduinoSwitchDialog = () => ({ type: CLOSE_SWITCH_DIALOG });

/**
 * 切り替えられないときのダイアログの中身。
 * @param {object} state - redux の state。
 * @returns {?{toStuduino: boolean, blocks: Array<object>}} 開いていなければ null。
 */
const getStuduinoSwitchDialog = (state) =>
    (state.scratchGui.studuinoMode && state.scratchGui.studuinoMode.switchDialog) || null;

export {
    reducer as default,
    closeStuduinoSwitchDialog,
    getStuduinoSwitchDialog,
    openStuduinoSwitchDialog,
    getStuduinoPendingSettings,
    setStuduinoPendingSettings,
    initialState as studuinoModeInitialState,
    SET_SETTINGS,
    closeStuduinoPortSettings,
    isStuduinoPortSettingsVisible,
    openStuduinoPortSettings,
    getStuduinoModeSettings,
    isStuduinoMode,
    setStuduinoModeSettings,
};
