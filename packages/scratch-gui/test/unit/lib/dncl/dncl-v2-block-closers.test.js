// Closer lines in the standard form (Issue #2058)
//
// The standard form closes a block by its indent, but a closer line of the
// DNCL-like form (`を実行する` / `を繰り返す` / `と定義する`) may be written at
// the end of any block too. With or without it, the Ruby must be the same.
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
import { rubyToDncl } from '../../../../src/lib/dncl/ruby-to-dncl';
import { loadPrism } from '../../../../src/lib/prism-parser';

const convert = (lines) => dnclToRuby(lines.join('\n'));
const ruby = (lines) => convert(lines).ruby;

// The program without its closer lines, closed by its indent only.
const withoutClosers = (lines) => lines.filter((line) => !/^\s*(?:を実行する|を繰り返す|と定義する)\s*$/.test(line));

const expectSameAsIndentOnly = (lines) => {
    const result = convert(lines);
    expect(result.errors).toEqual([]);
    expect(result.ruby).toBe(ruby(withoutClosers(lines)));
};

describe('closer lines in the standard form (Issue #2058)', () => {
    test.each([
        ['if', ['もし x > 0 ならば:', '    y = 1', 'を実行する', 'z = 2']],
        ['if / else', ['もし x > 0 ならば:', '    y = 1', 'そうでなければ:', '    y = 2', 'を実行する']],
        [
            'if / else-if / else',
            [
                'もし x > 0 ならば:',
                '    y = 1',
                'そうでなくもし x < 0 ならば:',
                '    y = 2',
                'そうでなければ:',
                '    y = 0',
                'を実行する',
            ],
        ],
        ['while', ['x < 3 の間繰り返す:', '    x = x + 1', 'を繰り返す', '表示する(x)']],
        ['counting loop', ['i を 1 から 3 まで 1 ずつ増やしながら繰り返す:', '    表示する(i)', 'を繰り返す']],
        ['counting down loop', ['i を 3 から 1 まで 1 ずつ減らしながら繰り返す:', '    表示する(i)', 'を繰り返す']],
        ['function', ['関数 二倍(a):', '    表示する(a * 2)', 'と定義する', '二倍(3)']],
        ['function written with を定義する', ['二倍(a) を定義する:', '    表示する(a * 2)', 'と定義する', '二倍(3)']],
    ])('a closer at the end of %s', (_name, lines) => {
        expectSameAsIndentOnly(lines);
    });

    test('the Ruby of a closed if', () => {
        expect(ruby(['もし x > 0 ならば:', '    y = 1', 'を実行する', 'z = 2'])).toBe(
            'if @x > 0\n  @y = 1\nend\n@z = 2',
        );
    });

    test('the standard function opener `関数 名前(引数):` makes a def', () => {
        expect(ruby(['関数 二倍(a):', '    表示する(a * 2)', 'と定義する', '二倍(3)'])).toBe(
            'def 二倍(a)\n  console.puts(a * 2)\nend\n二倍(3)',
        );
        expect(ruby(['関数 二倍(a):', '    表示する(a * 2)', '二倍(3)'])).toBe(
            'def 二倍(a)\n  console.puts(a * 2)\nend\n二倍(3)',
        );
    });

    test('a closer may be followed by `:` or a comment', () => {
        expectSameAsIndentOnly(['もし x > 0 ならば:', '    y = 1', 'を実行する:']);
        expect(ruby(['もし x > 0 ならば:', '    y = 1', 'を実行する # おわり'])).toBe(
            'if @x > 0\n  @y = 1\nend # おわり',
        );
    });

    test('a closer indented like the body closes the block', () => {
        expect(ruby(['もし x > 0 ならば:', '    y = 1', '    を実行する', 'z = 2'])).toBe(
            'if @x > 0\n  @y = 1\nend\n@z = 2',
        );
    });

    test('an indented closer of an empty block closes it', () => {
        const result = convert(['もし x > 0 ならば:', '    を実行する', 'z = 2']);
        expect(result.errors).toEqual([]);
        expect(result.ruby).toBe('if @x > 0\nend\n@z = 2');
    });

    describe('with and without closers mixed', () => {
        test('only the inner block has a closer', () => {
            expectSameAsIndentOnly([
                'i を 1 から 3 まで 1 ずつ増やしながら繰り返す:',
                '    もし i > 1 ならば:',
                '        表示する(i)',
                '    を実行する',
                '表示する(0)',
            ]);
        });

        test('only the outer block has a closer', () => {
            expectSameAsIndentOnly([
                'i を 1 から 3 まで 1 ずつ増やしながら繰り返す:',
                '    もし i > 1 ならば:',
                '        表示する(i)',
                '    表示する(9)',
                'を繰り返す',
            ]);
        });

        test('the outer closer also ends the inner block left open', () => {
            expectSameAsIndentOnly([
                'i を 1 から 3 まで 1 ずつ増やしながら繰り返す:',
                '    もし i > 1 ならば:',
                '        表示する(i)',
                'を繰り返す',
                '表示する(0)',
            ]);
        });

        test('a function with an if closed and a loop not', () => {
            expectSameAsIndentOnly([
                '関数 合計(n):',
                '    s = 0',
                '    i を 1 から n まで 1 ずつ増やしながら繰り返す:',
                '        もし i % 2 == 0 ならば:',
                '            s = s + i',
                '        を実行する',
                '    s を返す',
                'と定義する',
                '表示する(合計(10))',
            ]);
        });

        test('two blocks in a row, one closed and one not', () => {
            expectSameAsIndentOnly([
                'もし x > 0 ならば:',
                '    y = 1',
                'を実行する',
                'もし x < 0 ならば:',
                '    y = 2',
                'z = 3',
            ]);
        });
    });

    test('closers on numbered lines', () => {
        expectSameAsIndentOnly([
            '(01) x = 0',
            '(02) x < 3 の間繰り返す:',
            '(03)     もし x == 1 ならば:',
            '(04)         表示する(x)',
            '(05)     を実行する',
            '(06)     x = x + 1',
            '(07) を繰り返す',
        ]);
    });

    describe('closers next to the `⎿` markers', () => {
        const expected = 'if @x > 0\n  @y = 1\n  @z = 1\nend';

        test('a closer after the `⎿` that closed its block says the same end', () => {
            const result = convert(['もし x > 0 ならば:', '｜ y = 1', '⎿ z = 1', 'を実行する']);
            expect(result.errors).toEqual([]);
            expect(result.ruby.replace(/\n$/, '')).toBe(expected);
        });

        test('a closer on the `⎿` line says the same end', () => {
            const result = convert(['もし x > 0 ならば:', '｜ y = 1', '｜ z = 1', '⎿ を実行する', '表示する(x)']);
            expect(result.errors).toEqual([]);
            expect(result.ruby).toBe(`${expected}\nconsole.puts(@x)`);
        });

        test('a closer after nested `⎿` blocks ends the outer block', () => {
            expectSameAsIndentOnly([
                'i を 1 から 3 まで 1 ずつ増やしながら繰り返す:',
                '    もし i > 1 ならば:',
                '    ｜ 表示する(i)',
                '    ⎿ 表示する(0)',
                'を繰り返す',
            ]);
        });

        test('a `｜` body closed by a closer line', () => {
            expect(ruby(['もし x > 0 ならば:', '｜ y = 1', '｜ z = 1', 'を実行する'])).toBe(expected);
        });

        test('a second closer after `⎿` is still extra', () => {
            const result = convert(['もし x > 0 ならば:', '｜ y = 1', '⎿ z = 1', 'を実行する', 'を実行する']);
            expect(result.ruby).toBeNull();
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].line).toBe(5);
        });

        test('a closer after another block was closed is extra again', () => {
            const result = convert([
                'もし a ならば:',
                '｜ もし b ならば:',
                '｜ ⎿ x = 1',
                'を実行する',
                '｜ を実行する',
            ]);
            expect(result.ruby).toBeNull();
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].line).toBe(5);
        });

        test('the comment of a closer after `⎿` goes with the end, as when the closer closes the block', () => {
            expect(ruby(['もし x > 0 ならば:', '⎿ y = 1', 'を実行する # おわり', 'z = 2'])).toBe(
                'if @x > 0\n  @y = 1\nend # おわり\n@z = 2',
            );
        });

        test('the comment of a closer on the `⎿` line goes with the end', () => {
            expect(ruby(['もし x > 0 ならば:', '｜ y = 1', '⎿ を実行する # おわり', 'z = 2'])).toBe(
                'if @x > 0\n  @y = 1\nend # おわり\n@z = 2',
            );
        });
    });
});

// The end of a block after `⎿` and the comments after a block (Issue #2556).
describe('the end after `⎿` and the comments after a block (Issue #2556)', () => {
    beforeAll(() => loadPrism());

    const japanese = (source) => rubyToDncl(source).dncl;

    test('a closer after the `⎿` that closed its block leaves no blank line', () => {
        const lines = ['もし x > 0 ならば:', '⎿ 表示する(2)', 'を実行する', '表示する(3)'];
        const result = convert(lines);
        expect(result.errors).toEqual([]);
        expect(result.ruby).toBe('if @x > 0\n  console.puts(2)\nend\nconsole.puts(3)');
        expect(result.ruby).toBe(ruby(['もし x > 0 ならば:', '    表示する(2)', 'を実行する', '表示する(3)']));
        // Back in Japanese, no blank line is added.
        const back = japanese(result.ruby);
        expect(back).toBe('もし x > 0 ならば:\n    表示する(2)\n表示する(3)');
        expect(dnclToRuby(back).ruby).toBe(result.ruby);
    });

    test('a comment not indented after an if / else is after its end', () => {
        const lines = ['もし x > 0 ならば:', '    y = 1', 'そうでなければ:', '    y = 2', '# C'];
        const result = convert(lines);
        expect(result.errors).toEqual([]);
        expect(result.ruby).toBe('if @x > 0\n  @y = 1\nelse\n  @y = 2\nend\n# C');
        // Back in Japanese, the comment stays not indented, after the block.
        const back = japanese(result.ruby);
        expect(back).toBe('もし x > 0 ならば:\n    y = 1\nそうでなければ:\n    y = 2\nを実行する\n# C');
        expect(dnclToRuby(back).ruby).toBe(result.ruby);
    });

    test('a comment not indented after an if is after its end, before the next line', () => {
        expect(ruby(['もし x > 0 ならば:', '    y = 1', '# C', 'z = 2'])).toBe(
            'if @x > 0\n  @y = 1\nend\n# C\n@z = 2',
        );
    });

    test('an indented comment at the end of an if stays in it', () => {
        expect(ruby(['もし x > 0 ならば:', '    y = 1', '    # C', 'z = 2'])).toBe(
            'if @x > 0\n  @y = 1\n  # C\nend\n@z = 2',
        );
    });

    test('a comment not indented in the middle of an if stays in it when the if goes on', () => {
        expect(ruby(['もし x > 0 ならば:', '    y = 1', '# C', '    z = 2'])).toBe(
            'if @x > 0\n  @y = 1\n  # C\n  @z = 2\nend',
        );
    });
});
