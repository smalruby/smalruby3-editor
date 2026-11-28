// === Smalruby: This file is Smalruby-specific (Ruby to the Japanese of the Japanese mode) ===
import { rubyToJa } from '@smalruby/ja-notation';
import { getPrism } from '../prism-parser';
import { rubyErrorWords } from './ja-notation-errors';
import { SMALRUBY_RUBY_TO_JA } from './ja-notation-table';

// The types of the Scratch variables that are names in the program (not the messages).
const NAMED_VARIABLE_TYPES = ['', 'list'];

/**
 * The names of the variables and the lists of a sprite and of the stage, which
 * the counter of `n.times` must not take though the scripts do not use them:
 * the Japanese turned back into Ruby would make a variable of the sprite with
 * the name of one of the stage, or overwrite one (Issue #2574).
 * @param {?object} target - The target of the editor (a sprite or the stage).
 * @returns {Set<string>} The names.
 */
const reservedNamesOf = (target) => {
    const names = new Set();
    if (!target) return names;
    const stage = target.runtime && target.runtime.getTargetForStage ? target.runtime.getTargetForStage() : null;
    [target, stage].forEach((t) => {
        if (!t || !t.variables) return;
        Object.values(t.variables).forEach((v) => {
            if (NAMED_VARIABLE_TYPES.includes(v.type || '')) names.add(v.name);
        });
    });
    return names;
};

/**
 * Transpile Ruby (the Ruby the generator writes from the blocks, or the Ruby
 * of the editor) to the Japanese of the Japanese mode, in the standard form.
 *
 * The Ruby is parsed with prism, read into a syntax tree and written as
 * Japanese by ja-notation (packages/ja-notation/, with the Smalruby table of
 * ./ja-notation-table.js; J4 of docs/ruby-editor/converter-roadmap.md). Ruby
 * with no Japanese form is written as it is, and its errors are told on the
 * Ruby lines, in the words of the Japanese mode (./ja-notation-errors.js).
 *
 * prism must be loaded first (`loadPrism()` of src/lib/prism-parser.js).
 * @param {string} source - The Ruby source code.
 * @param {?object} [target] - The target of the Ruby: the counters of `n.times`
 *   do not take the names of its variables and of the stage (`reservedNamesOf`).
 * @returns {object} An object with `dncl` (the Japanese) and `errors` (code
 *   that cannot be written in the Japanese mode, with `line` / `column` of the
 *   Ruby source, `id`, `name` and `message`).
 */
const rubyToDncl = (source, target = null) => {
    const prism = getPrism();
    if (!prism) throw new Error('rubyToDncl: prism is not loaded (call loadPrism() first)');
    try {
        const result = rubyToJa(source, {
            ...SMALRUBY_RUBY_TO_JA,
            parse: (ruby) => prism.parse(ruby),
            reservedNames: reservedNamesOf(target),
        });
        return { dncl: result.ja, errors: rubyErrorWords(result.errors) };
    } catch (e) {
        // prism reads its syntax tree into JavaScript by recursion, so an expression
        // of some thousands of terms is too deep for it (ja-notation itself walks
        // the tree with a stack of its own), and must not stop the editor.
        if (!(e instanceof RangeError)) throw e;
        return { dncl: source, errors: [{ line: 1, column: 1, message: 'プログラムが長すぎて日本語にできません' }] };
    }
};

export { reservedNamesOf, rubyToDncl };
