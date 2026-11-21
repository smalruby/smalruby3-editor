// Studuino モード（#2213・M5・S1）。拡張機能「アーテックロボ」（smalrubotS1）の中の「動かし方」の 1 つで、
// プログラムを hex にして Studuino に書きこむ。状態の正は VM の studuino-settings.js（extensionStorage・#2212）。
// ここは GUI が使う判断（パレットに出すブロック・モードの切り替え）を 1 か所に集める。設計の正は
// docs/studuino-mode/README.md。
import {
    getStuduinoSettings,
    MODE_NORMAL,
    MODE_STUDUINO,
    setStuduinoSettings,
} from '@smalruby/scratch-vm/src/extensions/scratch3_smalrubot_s1/studuino-settings';

/** 拡張機能の ID（Studuino モードはこの拡張機能の中の動かし方）。 */
const STUDUINO_EXTENSION_ID = 'smalrubotS1';

/**
 * Studuino モードで使える標準のブロック（第 1 弾・S1。docs の「標準のブロック」）。
 * パレットに出すのも、使えないブロックの印（#2214）を決めるのも、この一覧を使う。
 * 部品のブロック（#2216）はここに足す。
 */
const STUDUINO_STANDARD_BLOCKS = Object.freeze([
    // イベント: 旗が押されたときだけ（電源を入れたときに動くのは 1 つだけ・M4）
    'event_whenflagclicked',
    // 制御（クローン・すべてを止めるは使えない）
    'control_wait',
    'control_repeat',
    'control_forever',
    'control_if',
    'control_if_else',
    'control_wait_until',
    'control_repeat_until',
    // 演算（文字列の演算・数学の関数は使えない）
    'operator_add',
    'operator_subtract',
    'operator_multiply',
    'operator_divide',
    'operator_random',
    'operator_gt',
    'operator_lt',
    'operator_equals',
    'operator_and',
    'operator_or',
    'operator_not',
    'operator_mod',
    'operator_round',
    // 調べる: タイマーだけ
    'sensing_timer',
    'sensing_resettimer',
    // 変数（数値だけ。表示・非表示とリストは使えない）
    'data_variable',
    'data_setvariableto',
    'data_changevariableby',
]);

/**
 * Studuino モードで使えるブロックの opcode の一覧。
 * @type {ReadonlyArray<string>}
 */
const STUDUINO_ALLOWED_BLOCKS = STUDUINO_STANDARD_BLOCKS;

/**
 * Studuino モードで使えるブロックか。
 * @param {string} opcode - ブロックの opcode。
 * @returns {boolean} 使えるなら true。
 */
const isStuduinoAllowedBlock = (opcode) => STUDUINO_ALLOWED_BLOCKS.includes(opcode);

/**
 * 設定が Studuino モードか。
 * @param {?object} settings - getStuduinoSettings の戻り値。
 * @returns {boolean} Studuino モードなら true。
 */
const isStuduinoModeSettings = (settings) => Boolean(settings && settings.mode === MODE_STUDUINO);

/**
 * 動かし方を変える（ポートの設定・補正値はそのまま）。保存は VM の extensionStorage。
 * @param {object} vm - VM。
 * @param {boolean} studuino - Studuino モードにするなら true、通常モードにもどすなら false。
 * @returns {?object} 書いたあとの設定（VM が無ければ null）。
 */
const setStuduinoMode = (vm, studuino) => {
    if (!vm || !vm.runtime) return null;
    const settings = getStuduinoSettings(vm.runtime);
    return setStuduinoSettings(vm.runtime, {
        ...settings,
        mode: studuino ? MODE_STUDUINO : MODE_NORMAL,
    });
};

export {
    STUDUINO_ALLOWED_BLOCKS,
    STUDUINO_EXTENSION_ID,
    STUDUINO_STANDARD_BLOCKS,
    isStuduinoAllowedBlock,
    isStuduinoModeSettings,
    setStuduinoMode,
};
