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

/** 一覧の項目の種類（#2353）。stop = 書きこみを止めた理由、warning = 書きこむが知らせる、info = 参考。 */
const NOTICE_KIND = Object.freeze({
    STOP: 'stop',
    WARNING: 'warning',
    INFO: 'info',
});

/**
 * 書きこみのモーダルに出す、ブロックを指す知らせの一覧（#2353・S7・S17）。押すとそのブロックへ移る。
 * 並びは、止めた理由（旗が 2 つ以上を先に。使われる旗・使われない旗の順）→ 警告。
 * ブロックに結びつかないエラー（旗が無い・全体が大きすぎる）は、一覧ではなく本文で知らせる。
 * @param {object} result - buildStuduinoIr の結果
 * @returns {Array<{kind: string, reason: string, blockId: string, targetId: string, variable?: string}>} 一覧
 */
const writeNotices = (result) => {
    const errors = (!result.ok && result.errors) || [];
    const notices = [];
    const seen = new Set();
    const push = (notice) => {
        if (!notice.blockId || seen.has(notice.blockId)) return;
        seen.add(notice.blockId);
        notices.push(notice);
    };
    const stop = (reason, e) => push({ kind: NOTICE_KIND.STOP, reason, blockId: e.blockId, targetId: e.targetId });

    const unusedFlags = errors.filter((e) => e.reason === STUDUINO_IR_ERRORS.TOO_MANY_FLAGS);
    if (unusedFlags.length > 0 && result.usedFlag) {
        push({ kind: NOTICE_KIND.INFO, reason: 'used_flag', ...result.usedFlag });
    }
    unusedFlags.forEach((e) => stop('unused_flag', e));
    errors.filter((e) => e.reason !== STUDUINO_IR_ERRORS.TOO_MANY_FLAGS).forEach((e) => stop(e.reason, e));
    (result.warnings || []).forEach((w) =>
        push({
            kind: NOTICE_KIND.WARNING,
            reason: w.reason,
            blockId: w.blockId,
            targetId: w.targetId,
            variable: w.variable,
        }),
    );
    return notices;
};

/**
 * 検査（構文木の生成）の結果から、次の段階を決める。
 * @param {object} result - buildStuduinoIr の結果
 * @returns {{step: string, notices: Array<object>, ir?: object, blocks?: Array<object>, noFlag?: boolean,
 *   tooLarge?: boolean, tooManyVariables?: boolean}} 次の段階（`notices` は writeNotices の一覧）
 */
const stepAfterCheck = (result) => {
    const notices = writeNotices(result);
    if (result.ok) return { step: STEP.COMPILING, ir: result.ir, notices };
    const errors = result.errors || [];
    return {
        step: STEP.CHECK_FAILED,
        blocks: errors.filter((e) => e.blockId),
        noFlag: errors.some((e) => e.reason === STUDUINO_IR_ERRORS.NO_FLAG),
        tooLarge: errors.some((e) => e.reason === STUDUINO_IR_ERRORS.TOO_LARGE),
        notices,
        // 変数の数の上限（S1）。ほかの「大きすぎる」と分けて、変数を減らすように知らせる
        tooManyVariables: errors.some(
            (e) => e.reason === STUDUINO_IR_ERRORS.TOO_LARGE && e.detail === 'too_many_variables',
        ),
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

export { NOTICE_KIND, progressMarks, STEP, stepAfterCheck, writeNotices, writePercent };
