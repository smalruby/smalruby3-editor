// The snippets of the Japanese mode put in the standard form (Issue #2035)
//
// A snippet puts in 標準の形 (`docs/dncl/design.md` 3 章, the 「書く」 column):
// a `:` at the end of the opener, the body indented 4 spaces and no closer
// line (`を実行する` / `を繰り返す` / `と定義する`). What a snippet puts in,
// with its places filled, becomes Ruby and blocks as it is, and the Ruby
// becomes the same Japanese again. The programs are made up for the tests.
import { DNCL_SNIPPETS } from '../../../../src/containers/ruby-tab/dncl-snippets';
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
import { rubyToDncl } from '../../../../src/lib/dncl/ruby-to-dncl';
import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';

// What a place of a snippet is filled with, by its default text.
const FILL = {
    条件: 'a > 0',
    名前: 'twice',
    引数: 'x',
    変数: 'b',
    配列名: 'A',
    値: 'a',
    範囲: '1..10',
    文字列: '"abc"',
    検索文字列: '"b"',
};

/**
 * Fill the places of a Monaco snippet: `${1:条件}` by `FILL` (or its default
 * text), an empty place alone on a line by a statement, other empty places
 * by a value.
 * @param {string} insertText - The snippet.
 * @returns {string} The Japanese the snippet puts in.
 */
const expand = (insertText) =>
    insertText
        .split('\n')
        .map((line) => {
            if (/^\s*\$\{\d+\}$/.test(line)) return line.replace(/\$\{\d+\}/, 'b = 1');
            return line.replace(/\$\{\d+(?::([^}]*))?\}/g, (_m, def) => {
                if (def === undefined) return 'a';
                return Object.prototype.hasOwnProperty.call(FILL, def) ? FILL[def] : def;
            });
        })
        .join('\n');

const BLOCK_OPENER = /^(?:もし|そうでなくもし|そうでなければ|関数 |.+ の間|.+ずつ(?:増やし|減らし)ながら)/;

// The snippets that put in a statement; the others put in a value.
const isStatement = (text) => text.includes('\n') || /^表示する\(|=|を返す$/.test(text);

/**
 * The program a snippet is tried in: the variables it uses are set first,
 * a value goes in an assignment and a return value in a function.
 * @param {string} text - What the snippet puts in.
 * @returns {string} The program.
 */
const programOf = (text) => {
    const head = ['a = 1', 'x = 1', 'i = 1', 'A = [1, 2]'];
    if (/を返す$/.test(text)) return [...head, '関数 f(x):', `    ${text}`].join('\n');
    if (isStatement(text)) return [...head, text].join('\n');
    return [...head, `c = ${text}`].join('\n');
};

const ROWS = DNCL_SNIPPETS.map((snippet) => [snippet.label, snippet.insertText]);
const BLOCK_ROWS = ROWS.filter(([, insertText]) => insertText.includes('\n'));

describe('DNCL snippets: the standard form (Issue #2035)', () => {
    test.each(BLOCK_ROWS)('%s has no closer line', (_label, insertText) => {
        expect(insertText).not.toMatch(/^\s*(?:を実行する|を繰り返す|と定義する)\s*$/m);
    });

    test.each(BLOCK_ROWS)('%s ends each opener with a `:` and indents its body 4 spaces', (_label, insertText) => {
        const lines = insertText.split('\n');
        lines.forEach((line, i) => {
            if (BLOCK_OPENER.test(line)) {
                expect(line).toMatch(/:$/);
                expect(lines[i + 1]).toMatch(/^ {4}\S/);
            }
        });
    });

    test.each(BLOCK_ROWS)('%s says 繰り返す: for a loop', (_label, insertText) => {
        if (/の間|ながら/.test(insertText)) expect(insertText).toMatch(/繰り返す:/);
    });

    test('there are snippets for else-if and for a return value', () => {
        expect(DNCL_SNIPPETS.some((s) => s.insertText.includes('そうでなくもし ${'))).toBe(true);
        expect(DNCL_SNIPPETS.some((s) => /を返す$/.test(s.insertText))).toBe(true);
    });
});

describe('DNCL snippets: what they put in becomes Ruby and blocks (Issue #2035)', () => {
    test.each(ROWS)('%s', async (_label, insertText) => {
        const { ruby, errors, blockErrors } = dnclToRuby(programOf(expand(insertText)));
        expect(errors).toEqual([]);
        expect(blockErrors).toEqual([]);
        const converter = new RubyToBlocksConverter(null, { version: '2' });
        const ok = await converter.targetCodeToBlocks(null, ruby);
        expect(converter.errors).toEqual([]);
        expect(ok).toBe(true);
    });
});

describe('DNCL snippets: the Ruby becomes the same Japanese again (Issue #2035)', () => {
    test.each(BLOCK_ROWS)('%s', (_label, insertText) => {
        const program = programOf(expand(insertText));
        expect(rubyToDncl(dnclToRuby(program).ruby).dncl).toBe(program);
    });
});
