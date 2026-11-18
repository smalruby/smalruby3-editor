// SPDX-License-Identifier: MIT
// ja-notation: Japanese (the 共通テスト用プログラム表記) ⇔ Ruby through syntax
// trees. See ./LICENSE and docs/ruby-editor/converter-roadmap.md (2 章).
//
// The library has no dependency: it imports nothing outside this directory,
// and the functions and names of a Ruby system are given by the caller.
import { buildRuby, RUBY } from './build-ruby';
import { parseStandard } from './parse-standard';
import { writeRuby } from './write-ruby';

/**
 * Japanese (the standard form) to Ruby: read (a), build (b) and write (c).
 * @param {string} source - The Japanese source.
 * @param {object} [options] - The table of names and functions (see `buildRuby`).
 * @returns {{ruby: ?string, jaLines: ?Array<number>, errors: Array<object>, program: ?object}}
 *   The Ruby (null on errors), the Japanese line of each Ruby line, the
 *   errors (`{code, message, line, column}` on Japanese lines) and the JaAST.
 */
const jaToRuby = (source, options = {}) => {
    const parsed = parseStandard(source);
    if (!parsed.program) return { ruby: null, jaLines: null, errors: parsed.errors, program: null };
    const built = buildRuby(parsed.program, options);
    if (!built.ruby) return { ruby: null, jaLines: null, errors: built.errors, program: parsed.program };
    const { ruby, jaLines } = writeRuby(built.ruby, source.split('\n').length);
    return { ruby, jaLines, errors: [], program: parsed.program };
};

export { buildRuby, jaToRuby, parseStandard, RUBY, writeRuby };
