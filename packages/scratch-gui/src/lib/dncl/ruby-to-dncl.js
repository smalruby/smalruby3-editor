// === Smalruby: This file is Smalruby-specific (Ruby to the Japanese of the Japanese mode) ===
import { rubyToJa } from '@smalruby/ja-notation';
import { getPrism } from '../prism-parser';
import { rubyErrorWords } from './ja-notation-errors';
import { SMALRUBY_RUBY_TO_JA } from './ja-notation-table';

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
 * @returns {object} An object with `dncl` (the Japanese) and `errors` (code
 *   that cannot be written in the Japanese mode, with `line` / `column` of the
 *   Ruby source, `id`, `name` and `message`).
 */
const rubyToDncl = (source) => {
    const prism = getPrism();
    if (!prism) throw new Error('rubyToDncl: prism is not loaded (call loadPrism() first)');
    try {
        const result = rubyToJa(source, { ...SMALRUBY_RUBY_TO_JA, parse: (ruby) => prism.parse(ruby) });
        return { dncl: result.ja, errors: rubyErrorWords(result.errors) };
    } catch (e) {
        // The syntax tree is as deep as the longest expression: one of thousands
        // of terms is too deep to read, and must not stop the editor.
        if (!(e instanceof RangeError)) throw e;
        return { dncl: source, errors: [{ line: 1, column: 1, message: 'プログラムが長すぎて日本語にできません' }] };
    }
};

export { rubyToDncl };
