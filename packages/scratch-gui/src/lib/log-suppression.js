/**
 * Suppress certain console warnings that are known upstream issues or intentional.
 */

const ignoredWarnings = [
    'Canvas2D: Multiple readback operations using getImageData are faster ' +
        'with the willReadFrequently attribute set to true',
    'Support for defaultProps will be removed from function components',
    'React does not recognize the',
    'The prop `projectId` is marked as required in `StageHeaderComponent`, but its value is `null`',
    'Invalid prop `projectId` of type `string` supplied to `StageHeaderComponent`, expected `number`',
    'The prop projectId is marked as required in StageHeaderComponent, but its value is null',
    'Invalid prop projectId of type string supplied to StageHeaderComponent, expected number',
    'componentWillMount has been renamed',
    'componentWillReceiveProps has been renamed',
    'componentWillUpdate has been renamed',
    'findDOMNode is deprecated',
    'The AudioContext was not allowed to start',
    'apple-mobile-web-app-capable',
    'GenerateSW has been called multiple times',
    // Monaco editor (editor.api-*.js) のタッチハンドラが start を取り逃した
    // touch の move / end を受け取ると警告を吐く。モバイル UI で blockly や
    // ステージにタッチを始めて Monaco エリアに指が乗ったまま離す等で発生
    // するが実害は無く、画面サイズが小さい環境では繰り返し発生して
    // ノイズになるため抑止する。
    'of an UNKNOWN touch',
    // Blockly v12 / scratch-blocks v2 の既知ノイズ。upstream merge 後に
    // initial inject のタイミングで以下の警告が発生するが、その後の
    // workspace.registerToolboxCategoryCallback で正しい callback に上書き
    // されるため UI 上は問題ない (Variables / Procedures カテゴリは正常動作)。
    // upstream でも同じ警告が出るが無視されている。
    'Unable to find [category][flyoutinflater] in the registry',
    'There are no variable blocks, but there is a variable category',
    // v12 で getVariablesOfType が getVariableMap().getVariablesOfType に
    // 移行する予定の deprecation warning。scratch-blocks v2 内部からの
    // 呼び出しなので Smalruby 側では触れない。
    'Blockly.Workspace.getVariablesOfType was deprecated in v12',
    // FieldColourSlider のシャドウブロック初期化中に slider/readout DOM が
    // まだ作られていない状態で setValue が呼ばれて警告を吐く。実害は無く、
    // 初期化完了後は正しい値が反映される。scratch-blocks v2 内部の
    // 初期化順の問題。
    'FieldColourSlider.updateSliderHandles_: slider DOM is not fully initialized',
    'FieldColourSlider.updateDom_: slider/readout DOM is not fully initialized',
];

/**
 * Check if a message should be ignored.
 * @param {string} message The message to check.
 * @param {Array} args Additional arguments.
 * @returns {boolean} True if the message should be ignored.
 */
const shouldIgnore = (message, ...args) => {
    const allStrings = [message, ...args].filter((arg) => typeof arg === 'string');
    return allStrings.some((str) => ignoredWarnings.some((ignored) => str.includes(ignored)));
};

/* eslint-disable no-console */
const originalWarn = console.warn;
const originalError = console.error;

console.warn = function (message, ...args) {
    if (shouldIgnore(message, ...args)) return;
    originalWarn.apply(console, [message, ...args]);
};

console.error = function (message, ...args) {
    if (shouldIgnore(message, ...args)) return;
    originalError.apply(console, [message, ...args]);
};
/* eslint-enable no-console */
