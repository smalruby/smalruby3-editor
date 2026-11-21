// Studuino モードの書きこみの進み具合（#2219・S13）。画面に出す段階を純粋関数で決める。
// 検査 → hex を作る → （［書きこむ］を押す）→ 書きこむ → おわり。
import { STUDUINO_IR_ERRORS } from './studuino-ir/build-studuino-ir';

/** 段階。 */
const STEP = Object.freeze({
    CHECKING: 'checking',
    CHECK_FAILED: 'checkFailed',
    COMPILING: 'compiling',
    COMPILE_FAILED: 'compileFailed',
    READY: 'ready',
    WRITING: 'writing',
    WRITE_FAILED: 'writeFailed',
    ABORTED: 'aborted',
    DONE: 'done',
});

/**
 * 検査（構文木の生成）の結果から、次の段階を決める。
 * @param {object} result - buildStuduinoIr の結果
 * @returns {{step: string, ir?: object, blocks?: Array<object>, noFlag?: boolean, tooLarge?: boolean}} 次の段階
 */
const stepAfterCheck = (result) => {
    if (result.ok) return { step: STEP.COMPILING, ir: result.ir };
    const errors = result.errors || [];
    return {
        step: STEP.CHECK_FAILED,
        blocks: errors.filter((e) => e.blockId),
        noFlag: errors.some((e) => e.reason === STUDUINO_IR_ERRORS.NO_FLAG),
        tooLarge: errors.some((e) => e.reason === STUDUINO_IR_ERRORS.TOO_LARGE),
    };
};

/**
 * 書きこみの進み具合を 0〜100 にする。
 * @param {number} written - 書いたバイト数
 * @param {number} total - 全体のバイト数
 * @returns {number} 百分率（整数）
 */
const writePercent = (written, total) => {
    if (!total || total <= 0) return 0;
    return Math.max(0, Math.min(100, Math.floor((written / total) * 100)));
};

/**
 * 段階の表示（上から順の 3 つの段階のどこまで終わったか）。
 * @param {string} step - いまの段階
 * @returns {{check: string, compile: string, write: string}} それぞれ 'todo' / 'doing' / 'done' / 'failed'
 */
const progressMarks = (step) => {
    const order = {
        [STEP.CHECKING]: ['doing', 'todo', 'todo'],
        [STEP.CHECK_FAILED]: ['failed', 'todo', 'todo'],
        [STEP.COMPILING]: ['done', 'doing', 'todo'],
        [STEP.COMPILE_FAILED]: ['done', 'failed', 'todo'],
        [STEP.READY]: ['done', 'done', 'todo'],
        [STEP.WRITING]: ['done', 'done', 'doing'],
        [STEP.WRITE_FAILED]: ['done', 'done', 'failed'],
        [STEP.ABORTED]: ['done', 'done', 'failed'],
        [STEP.DONE]: ['done', 'done', 'done'],
    }[step] || ['todo', 'todo', 'todo'];
    return { check: order[0], compile: order[1], write: order[2] };
};

export { progressMarks, STEP, stepAfterCheck, writePercent };
