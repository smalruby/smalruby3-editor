// === Smalruby: This file is Smalruby-specific (DNCL to Ruby transpiler) ===
import { jaToRuby } from '@smalruby/ja-notation';
import { DnclSourceMap } from './dncl-source-map';
import { jaNotationErrors } from './ja-notation-errors';
import { SMALRUBY_JA_NOTATION } from './ja-notation-table';

/**
 * Transpile the Japanese of the Japanese mode (the standard form, the
 * DNCL-like form or both mixed) to Ruby.
 *
 * The Japanese is read into a syntax tree and written as Ruby by ja-notation
 * (packages/ja-notation/, with the Smalruby table of ./ja-notation-table.js),
 * which also gives the Japanese line of each Ruby line. The errors are said
 * in the words of the Japanese mode (./ja-notation-errors.js). A program that
 * cannot be read makes no Ruby, so a missing or extra closing line is told
 * here, on its Japanese line, and never as a missing `end` of the converter.
 * @param {string} source - The Japanese source code.
 * @returns {object} An object with `ruby` (the Ruby code, or `null` on
 *   errors), `errors` (`{line, column, message}`, and `id` / `name` for the
 *   errors the UI translates, on Japanese lines) and `sourceMap` (a
 *   `DnclSourceMap` between `source` and `ruby`, or `null` on errors).
 */
const dnclToRuby = (source) => {
    let result;
    try {
        result = jaToRuby(source, SMALRUBY_JA_NOTATION);
    } catch (e) {
        // The syntax tree is as deep as the longest expression: one of thousands
        // of terms is too deep to read, and must not stop the editor.
        if (!(e instanceof RangeError)) throw e;
        return {
            ruby: null,
            errors: [{ line: 1, column: 1, message: 'プログラムが長すぎて読めません' }],
            sourceMap: null,
        };
    }
    if (result.ruby === null) {
        return { ruby: null, errors: jaNotationErrors(source, result.errors), sourceMap: null };
    }
    return {
        ruby: result.ruby,
        errors: [],
        sourceMap: new DnclSourceMap(result.jaLines, source.split('\n').length),
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
