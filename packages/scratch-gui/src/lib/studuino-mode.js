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

/** パレットの「入出力の設定」ボタンの callbackKey（#2215・S4）。 */
const STUDUINO_PORT_SETTINGS_CALLBACK = 'STUDUINO_PORT_SETTINGS';

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

const xmlEscape = (text) =>
    String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

/**
 * Studuino モードのパレットの先頭に置くカテゴリ（アーテックロボ）の XML。先頭に「入出力の設定」ボタン
 * （「変数を作る」と同じ形のボタン・S4）を置く。部品のブロック（#2216）はこのカテゴリに足す。
 * @param {object} options - 表示の文言と色。
 * @param {string} options.name - カテゴリの名前。
 * @param {string} options.buttonText - ボタンの文言。
 * @param {{colourPrimary: string, colourTertiary: string}} options.colors - カテゴリの色（拡張機能の色）。
 * @returns {string} category の XML。
 */
const makeStuduinoCategoryXml = ({ name, buttonText, colors }) =>
    `<category name="${xmlEscape(name)}" id="${STUDUINO_EXTENSION_ID}" toolboxitemid="${STUDUINO_EXTENSION_ID}" ` +
    `colour="${xmlEscape(colors.colourPrimary)}" secondaryColour="${xmlEscape(colors.colourTertiary)}">` +
    `<button text="${xmlEscape(buttonText)}" callbackKey="${STUDUINO_PORT_SETTINGS_CALLBACK}"></button>` +
    `</category>`;

/**
 * toolbox の XML の先頭（最初のカテゴリの前）にカテゴリを入れる。
 * @param {?string} toolboxXML - makeToolboxXML の戻り値。
 * @param {string} categoryXML - 入れるカテゴリ。
 * @returns {?string} 入れたあとの XML（toolboxXML が無ければそのまま）。
 */
const prependToolboxCategory = (toolboxXML, categoryXML) => {
    if (!toolboxXML) return toolboxXML;
    const match = toolboxXML.match(/^\s*<xml[^>]*>/);
    if (!match) return toolboxXML;
    const head = match[0];
    return `${head}\n${categoryXML}\n<sep gap="36"/>${toolboxXML.slice(head.length)}`;
};

export {
    STUDUINO_ALLOWED_BLOCKS,
    STUDUINO_EXTENSION_ID,
    STUDUINO_PORT_SETTINGS_CALLBACK,
    makeStuduinoCategoryXml,
    prependToolboxCategory,
    STUDUINO_STANDARD_BLOCKS,
    isStuduinoAllowedBlock,
    isStuduinoModeSettings,
    setStuduinoMode,
};
