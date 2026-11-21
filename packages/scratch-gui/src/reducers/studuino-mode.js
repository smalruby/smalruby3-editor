// Studuino モードの GUI の状態（#2213）。設定の正は VM（runtime.extensionStorage・#2212）で、
// ここはその写し（containers/studuino-mode-sync.jsx が VM のイベントで更新する）と、画面だけの状態を持つ。
import { defaultSettings } from '@smalruby/scratch-vm/src/extensions/scratch3_smalrubot_s1/studuino-settings';
import { isStuduinoModeSettings } from '../lib/studuino-mode';

const SET_SETTINGS = 'scratch-gui/studuino-mode/SET_SETTINGS';

const initialState = {
    // VM の getStuduinoSettings の写し（mode・ports・calibration・unknownVersion）
    settings: defaultSettings(),
};

const reducer = (state, action) => {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
        case SET_SETTINGS:
            return { ...state, settings: action.settings || defaultSettings() };
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
 * Studuino モードか（GUI のどこからでもこれで判定する。緑の旗＝書きこみ・停止＝中断（#2219）もこれを見る）。
 * @param {object} state - redux の state。
 * @returns {boolean} Studuino モードなら true。
 */
const isStuduinoMode = (state) => isStuduinoModeSettings(state.scratchGui.studuinoMode.settings);

/**
 * Studuino の設定（ポート・補正値を含む）。
 * @param {object} state - redux の state。
 * @returns {object} 設定。
 */
const getStuduinoModeSettings = (state) => state.scratchGui.studuinoMode.settings;

export {
    reducer as default,
    initialState as studuinoModeInitialState,
    SET_SETTINGS,
    getStuduinoModeSettings,
    isStuduinoMode,
    setStuduinoModeSettings,
};
