// SPDX-License-Identifier: MIT
// ja-notation: Japanese (the 共通テスト用プログラム表記) ⇔ Ruby through syntax
// trees. See ../LICENSE and docs/ruby-editor/converter-roadmap.md (2 章).
//
// The library has no dependency: it imports nothing outside this directory,
// and the functions and names of a Ruby system are given by the caller.
import { buildRuby, RUBY } from './build-ruby.js';
import { parse } from './parse.js';
import { readRuby } from './read-ruby.js';
import { DEFAULT_SETTINGS, readSettings, settingsSentences } from './settings.js';
import { writeJa } from './write-ja.js';
import { writeRuby } from './write-ruby.js';

/**
 * Japanese (the standard form or the DNCL-like form) to Ruby: read (a), build (b) and write (c).
 * @param {string} source - The Japanese source.
 * @param {object} [options] - The table of names and functions (see `buildRuby`).
 * @returns {{ruby: ?string, jaLines: ?Array<number>, errors: Array<object>, program: ?object}}
 *   The Ruby (null on errors), the Japanese line of each Ruby line, the
 *   errors (`{code, message, line, column}` on Japanese lines) and the JaAST.
 */
const jaToRuby = (source, options = {}) => {
    const parsed = parse(source);
    if (!parsed.program) return { ruby: null, jaLines: null, errors: parsed.errors, program: null };
    const built = buildRuby(parsed.program, options);
    if (!built.ruby) return { ruby: null, jaLines: null, errors: built.errors, program: parsed.program };
    const { ruby, jaLines } = writeRuby(built.ruby, source.split('\n').length);
    return { ruby, jaLines, errors: [], program: parsed.program };
};

/**
 * Ruby to Japanese in the standard form: parse with prism, read the tree (d)
 * and write the Japanese (e).
 * @param {string} source - The Ruby source.
 * @param {object} options - `parse` (the parse function of prism, given by the
 *   caller: `parse(source)` gives `{value, comments, errors}`) and the tables of
 *   the Ruby system (see `readRuby`).
 * @returns {{ja: string, errors: Array<object>, program: object}} The Japanese
 *   (written also when there are errors: the Ruby with no Japanese form is kept
 *   as it is), the errors (`{code, message, line, column}` on Ruby lines) and the JaAST.
 */
const rubyToJa = (source, options) => {
    const { program, errors } = readRuby(options.parse(source), source, options);
    return { ja: writeJa(program), errors, program };
};

export {
    buildRuby,
    DEFAULT_SETTINGS,
    jaToRuby,
    parse,
    readRuby,
    readSettings,
    RUBY,
    rubyToJa,
    settingsSentences,
    writeJa,
    writeRuby,
};
