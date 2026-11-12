// === Smalruby: This file is Smalruby-specific (DNCL to Ruby transpiler) ===
import { convertLine, resetForLoopStack } from './dncl-line-converter';
import { DnclSourceMap } from './dncl-source-map';
import { detectArrayNames, detectFunctionNames, resetFunctionScopes } from './dncl-state';
import { splitTrailingComment } from './dncl-trailing-comment';
import { dnclV2PreprocessWithLineMap } from './dncl-v2-preprocessor';
import { findDnclBlockErrors, validateDncl } from './dncl-validator';

/**
 * Transpile DNCL source code to Ruby.
 *
 * The source is first run through `dnclV2PreprocessWithLineMap` to normalize
 * any DNCLv2 syntax (line numbers, trailing colons, `繰り返す` suffix,
 * comma-separated multi-assignment, `and`/`or`, etc.) into the existing
 * Smalruby DNCL form. Pure Smalruby DNCL passes through unchanged.
 *
 * Both the pre-processor and the line converter may change the line count
 * (joined / split lines, added closers, 2-line input and counting loops), so
 * the line correspondence is tracked line by line instead of being guessed
 * from the sources afterwards.
 * @param {string} source - The DNCL source code.
 * @returns {object} An object with `ruby` (the transpiled Ruby code or
 *   `null` on validation error), `errors` (array of validation errors whose
 *   `line` is the DNCL source line), and `sourceMap` (a `DnclSourceMap`
 *   between `source` and `ruby`, or `null` on validation error), and
 *   `blockErrors` (a missing or extra closer said in the words of DNCL, on
 *   DNCL source lines; the Ruby is still made, and these are shown instead
 *   of the converter's missing / extra `end` when it fails — Issue #1419).
 */
const dnclToRuby = (source) => {
    const { source: preprocessed, lineMap, columnShift } = dnclV2PreprocessWithLineMap(source);
    // Errors are found on the pre-processed lines, whose indent is made from
    // the block depth (Issue #1718): put their columns back on the source.
    const toSource = (err) => ({
        ...err,
        line: lineMap[err.line - 1] || err.line,
        column: err.column + (columnShift[err.line - 1] || 0),
    });
    const sourceLineCount = source.split('\n').length;
    // A `# comment` at the end of a line is taken off before the lines are
    // checked and converted, so `もし a > 0 ならば # c` still opens a block,
    // and put back at the end of the Ruby line (Issue #1696). Taking it off
    // keeps the line count, so the line map still holds.
    const parts = preprocessed.split('\n').map(splitTrailingComment);
    const normalized = parts.map((part) => part.code).join('\n');

    const errors = validateDncl(normalized);
    if (errors.length > 0) {
        return {
            ruby: null,
            errors: errors.map(toSource),
            sourceMap: null,
            blockErrors: [],
        };
    }

    detectArrayNames(normalized);
    detectFunctionNames(normalized);
    resetForLoopStack();
    resetFunctionScopes();

    const rubyLines = [];
    const rubyToDncl = [];
    parts.forEach(({ code, comment }, idx) => {
        // A line may become several Ruby lines (a counting loop, an input);
        // the comment goes after the last, which carries the block keyword.
        for (const rubyLine of `${convertLine(code)}${comment}`.split('\n')) {
            rubyLines.push(rubyLine);
            rubyToDncl.push(lineMap[idx]);
        }
    });

    return {
        ruby: rubyLines.join('\n'),
        errors: [],
        sourceMap: new DnclSourceMap(rubyToDncl, sourceLineCount),
        blockErrors: findDnclBlockErrors(normalized).map((err) => ({
            ...err,
            line: lineMap[err.line - 1] || err.line,
        })),
    };
};

/**
 * The Ruby to show when leaving the Japanese mode. DNCL that cannot become
 * Ruby (the post-test loop of issue #1626 shown from blocks, `@` / `$`)
 * makes no Ruby, so the last Ruby made from the editor (or from the blocks)
 * is kept: the switch to the Ruby mode, where such code can be written, must
 * not fail.
 * @param {string} dncl - The DNCL in the editor.
 * @param {?string} lastRuby - The last Ruby of the editor.
 * @returns {string} The Ruby to show.
 */
const rubyForLeavingDncl = (dncl, lastRuby) => {
    const { ruby } = dnclToRuby(dncl);
    return ruby === null ? lastRuby || '' : ruby;
};

export { dnclToRuby, rubyForLeavingDncl };
