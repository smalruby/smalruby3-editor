import { DnclSourceMap } from '../../../../src/lib/dncl/dncl-source-map';
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';

/**
 * 1-based number of the only Ruby line that contains `text`.
 * @param {string} ruby - The Ruby source.
 * @param {string} text - A fragment that appears on exactly one line.
 * @returns {number} The 1-based line number.
 */
const rubyLineOf = (ruby, text) => {
    const hits = ruby
        .split('\n')
        .map((line, idx) => (line.includes(text) ? idx + 1 : null))
        .filter((n) => n !== null);
    expect(hits).toHaveLength(1);
    return hits[0];
};

describe('DnclSourceMap', () => {
    describe('line mapping', () => {
        test('simple 1:1 line mapping', () => {
            const dncl = 'a = 1\nb = 2\nc = 3';
            const map = dnclToRuby(dncl).sourceMap;

            // DNCL line 1 → Ruby line 1
            expect(map.dnclLineToRubyLine(1)).toBe(1);
            expect(map.dnclLineToRubyLine(2)).toBe(2);
            expect(map.dnclLineToRubyLine(3)).toBe(3);
        });

        test('input expansion: 1 DNCL line → 2 Ruby lines', () => {
            const dncl = 'a = 【外部からの入力】\nb = 2';
            const map = dnclToRuby(dncl).sourceMap;

            // DNCL line 1 → Ruby lines 1-2
            expect(map.dnclLineToRubyLine(1)).toBe(1);
            // DNCL line 2 → Ruby line 3 (shifted by expansion)
            expect(map.dnclLineToRubyLine(2)).toBe(3);
        });

        test('reverse: Ruby line to DNCL line', () => {
            const dncl = 'a = 【外部からの入力】\nb = 2';
            const map = dnclToRuby(dncl).sourceMap;

            // Ruby line 1 (ask) → DNCL line 1
            expect(map.rubyLineToDnclLine(1)).toBe(1);
            // Ruby line 2 (a = answer) → DNCL line 1
            expect(map.rubyLineToDnclLine(2)).toBe(1);
            // Ruby line 3 → DNCL line 2
            expect(map.rubyLineToDnclLine(3)).toBe(2);
        });

        test('control flow: 1:1 mapping', () => {
            const dncl = 'もし a > 0 なら\n  a = 1\nを実行する';
            const map = dnclToRuby(dncl).sourceMap;

            expect(map.dnclLineToRubyLine(1)).toBe(1);
            expect(map.dnclLineToRubyLine(2)).toBe(2);
            expect(map.dnclLineToRubyLine(3)).toBe(3);
        });

        test('blank lines preserved', () => {
            const dncl = 'a = 1\n\nb = 2';
            const map = dnclToRuby(dncl).sourceMap;

            expect(map.dnclLineToRubyLine(1)).toBe(1);
            expect(map.dnclLineToRubyLine(2)).toBe(2);
            expect(map.dnclLineToRubyLine(3)).toBe(3);
        });

        test('out-of-range Ruby lines are clamped to the first / last DNCL line', () => {
            const map = new DnclSourceMap([2, 2, 3], 3);

            expect(map.rubyLineToDnclLine(0)).toBe(2);
            expect(map.rubyLineToDnclLine(10)).toBe(3);
        });

        test('an empty map returns Ruby lines unchanged', () => {
            const map = new DnclSourceMap([], 0);

            expect(map.rubyLineToDnclLine(3)).toBe(3);
        });

        test('out-of-range DNCL lines are returned unchanged', () => {
            const map = new DnclSourceMap([1, 1, 2], 2);

            expect(map.dnclLineToRubyLine(0)).toBe(0);
            expect(map.dnclLineToRubyLine(10)).toBe(10);
        });
    });

    describe('lines after DNCLv2 pre-processing', () => {
        test('lines after a block closed with ⎿ map to the right DNCL line', () => {
            const dncl = ['もし a > 0 ならば:', '⎿ a = 1', 'bb = 2'].join('\n');
            const { ruby, sourceMap } = dnclToRuby(dncl);

            // The `⎿` adds an `end` line, so Ruby has one more line than DNCL.
            expect(ruby.split('\n')).toHaveLength(4);
            expect(sourceMap.rubyLineToDnclLine(rubyLineOf(ruby, 'bb = 2'))).toBe(3);
            // The added `end` belongs to the `⎿` line.
            expect(sourceMap.rubyLineToDnclLine(rubyLineOf(ruby, 'end'))).toBe(2);
            expect(sourceMap.dnclLineToRubyLine(3)).toBe(rubyLineOf(ruby, 'bb = 2'));
        });

        test('lines after joined continuation lines map to the right DNCL line', () => {
            const dncl = ['(1) 表示する(aa,', '        bb)', '(2) cc = 1'].join('\n');
            const { ruby, sourceMap } = dnclToRuby(dncl);

            // The two DNCL lines are joined into one Ruby line.
            expect(ruby.split('\n')).toHaveLength(2);
            expect(sourceMap.rubyLineToDnclLine(rubyLineOf(ruby, 'cc = 1'))).toBe(3);
            // The joined line belongs to its first line.
            expect(sourceMap.rubyLineToDnclLine(1)).toBe(1);
            expect(sourceMap.dnclLineToRubyLine(3)).toBe(rubyLineOf(ruby, 'cc = 1'));
            // The continuation line itself points at the joined Ruby line.
            expect(sourceMap.dnclLineToRubyLine(2)).toBe(1);
        });

        test('lines after an indentation-style block map to the right DNCL line', () => {
            const dncl = ['もし aa > 0 ならば:', '    aa = 1', 'bb = 2'].join('\n');
            const { ruby, sourceMap } = dnclToRuby(dncl);

            // An `end` line is added before `bb = 2`.
            expect(ruby.split('\n')).toHaveLength(4);
            expect(sourceMap.rubyLineToDnclLine(rubyLineOf(ruby, 'bb = 2'))).toBe(3);
            // The added `end` belongs to the last line of the block it closes.
            expect(sourceMap.rubyLineToDnclLine(rubyLineOf(ruby, 'end'))).toBe(2);
        });

        test('a closer added before blank lines maps to the last code line of the block', () => {
            const dncl = ['もし aa > 0 ならば:', '    aa = 1', '', 'bb = 2'].join('\n');
            const { ruby, sourceMap } = dnclToRuby(dncl);

            expect(sourceMap.rubyLineToDnclLine(rubyLineOf(ruby, 'end'))).toBe(2);
            expect(sourceMap.rubyLineToDnclLine(rubyLineOf(ruby, 'bb = 2'))).toBe(4);
        });

        test('an indentation-style block still open at the end maps its end line', () => {
            const dncl = ['もし aa > 0 ならば:', '    aa = 1'].join('\n');
            const { ruby, sourceMap } = dnclToRuby(dncl);

            expect(ruby.split('\n')).toHaveLength(3);
            expect(sourceMap.rubyLineToDnclLine(3)).toBe(2);
        });

        test('lines after input lines (2 Ruby lines) still map correctly', () => {
            const dncl = ['(1) aa = 【整数を入力】', '(2) bb = 【文字列を入力】', '(3) cc = 1'].join('\n');
            const { ruby, sourceMap } = dnclToRuby(dncl);

            expect(ruby.split('\n')).toHaveLength(5);
            expect(sourceMap.rubyLineToDnclLine(rubyLineOf(ruby, 'cc = 1'))).toBe(3);
            expect(sourceMap.rubyLineToDnclLine(rubyLineOf(ruby, 'answer.to_i'))).toBe(1);
        });

        test('lines after a counting loop (2 Ruby lines per opener and closer) map correctly', () => {
            const dncl = ['i を 1 から 3 まで 1 ずつ増やしながら', '  表示する(i)', 'を繰り返す', 'cc = 1'].join(
                '\n',
            );
            const { ruby, sourceMap } = dnclToRuby(dncl);

            expect(sourceMap.rubyLineToDnclLine(rubyLineOf(ruby, 'while'))).toBe(1);
            expect(sourceMap.rubyLineToDnclLine(rubyLineOf(ruby, '+= 1'))).toBe(3);
            expect(sourceMap.rubyLineToDnclLine(rubyLineOf(ruby, 'cc = 1'))).toBe(4);
            expect(sourceMap.dnclLineToRubyLine(4)).toBe(rubyLineOf(ruby, 'cc = 1'));
        });

        test('comma-separated multi-assignment maps both lines to the source line', () => {
            const dncl = ['(1) aa = 0 , bb = 1', '(2) cc = 2'].join('\n');
            const { ruby, sourceMap } = dnclToRuby(dncl);

            expect(sourceMap.rubyLineToDnclLine(rubyLineOf(ruby, 'aa = 0'))).toBe(1);
            expect(sourceMap.rubyLineToDnclLine(rubyLineOf(ruby, 'bb = 1'))).toBe(1);
            expect(sourceMap.rubyLineToDnclLine(rubyLineOf(ruby, 'cc = 2'))).toBe(2);
        });
    });

    describe('validation errors', () => {
        test('reports validation errors at the DNCL source line', () => {
            const dncl = ['(1) aa = 1', '(2) bb = (2 +', '      3)', '(3) @cc = 1'].join('\n');
            const { errors } = dnclToRuby(dncl);

            expect(errors).toHaveLength(1);
            expect(errors[0].line).toBe(4);
        });
    });

    describe('editor error remapping', () => {
        test('moves errors to their DNCL line and marks the whole line', () => {
            const dncl = 'a = 【外部からの入力】\nb = 2\nc = error';
            const map = dnclToRuby(dncl).sourceMap;
            const errors = [
                { row: 1, column: 4, source: 'answer', text: 'e1' },
                { row: 3, column: 4, source: 'error', text: 'e2' },
            ];

            expect(map.rubyErrorsToDncl(errors)).toEqual([
                { row: 0, column: 0, source: null, text: 'e1' },
                { row: 2, column: 0, source: null, text: 'e2' },
            ]);
            // The input errors are not modified.
            expect(errors[0]).toEqual({ row: 1, column: 4, source: 'answer', text: 'e1' });
        });

        // The converter keeps the error of an `elsif` condition on the `elsif` line (issue #1704),
        // so the mark is on the line of そうでなくもし, not on the line of もし above it.
        test('an error in the condition of そうでなくもし lands on its line', () => {
            const dncl = 'a = 1\nもし a > 0 ならば\n  b = 1\nそうでなくもし a.foo > 5 ならば\n  b = 2\nを実行する';
            const { ruby, errors } = dnclToRuby(dncl);

            // A method of Ruby is not read as Japanese: it makes no Ruby.
            expect(ruby).toBeNull();
            expect(errors.map((err) => err.line)).toEqual([4]);
        });

        // The converter quotes the Ruby statement (`"@a, @b = @b, @a" is the wrong instruction.`),
        // which has `@` the student did not write: the Japanese line is quoted instead (issue #1822).
        describe('the quoted Ruby becomes the Japanese line', () => {
            test('in the English and the Japanese words', () => {
                const map = dnclToRuby('a, b = b, a').sourceMap;
                const moved = map.rubyErrorsToDncl([
                    {
                        row: 0,
                        column: 0,
                        source: '@a, @b = @b, @a',
                        text: '"@a, @b = @b, @a" is the wrong instruction.',
                    },
                    {
                        row: 0,
                        column: 0,
                        source: '@a, @b = @b, @a',
                        text: '「@a, @b = @b, @a」は命令がまちがっています。',
                    },
                ]);

                expect(moved.map((err) => err.text)).toEqual([
                    '"a, b = b, a" is the wrong instruction.',
                    '「a, b = b, a」は命令がまちがっています。',
                ]);
            });

            test('without the line number, the marks of the block and the comment', () => {
                const dncl = ['(1) もし a > 0 ならば:', '(2) ⎿ x = 含む(1, 2)  # 確かめる'].join('\n');
                const { ruby, sourceMap } = dnclToRuby(dncl);
                const row = rubyLineOf(ruby, 'include?') - 1;
                const source = ruby.split('\n')[row].trim();
                const [moved] = sourceMap.rubyErrorsToDncl([
                    { row, column: 2, source, text: `「${source}」は命令がまちがっています。` },
                ]);

                expect(moved.row).toBe(1);
                expect(moved.text).toBe('「x = 含む(1, 2)」は命令がまちがっています。');
            });

            test('a statement of more lines quoted by its first line', () => {
                const dncl = ['もし a.foo > 0 ならば:', '    b = 1'].join('\n');
                const map = new DnclSourceMap([1, 2, 2], 2, {
                    ja: dncl,
                    ruby: 'if @a.foo > 0\n  @b = 1\nend',
                });
                const [moved] = map.rubyErrorsToDncl([
                    {
                        row: 0,
                        column: 0,
                        source: 'if @a.foo > 0...',
                        text: '"if @a.foo > 0..." is the wrong instruction.',
                    },
                ]);

                expect(moved.text).toBe('"もし a.foo > 0 ならば:" is the wrong instruction.');
            });

            test('a long line cut as the converter cuts it', () => {
                const name = 'とてもながいなまえのへんすう';
                const dncl = `${name}1, ${name}2 = ${name}2, ${name}1`;
                const map = dnclToRuby(dncl).sourceMap;
                const ruby = `@${name}1, @${name}2 = @${name}2, @${name}1`;
                const cut = `${ruby.slice(0, 40)}...`;
                const [moved] = map.rubyErrorsToDncl([
                    { row: 0, column: 0, source: cut, text: `"${cut}" is the wrong instruction.` },
                ]);

                expect(moved.text).toBe(`"${dncl.slice(0, 40)}..." is the wrong instruction.`);
            });

            test('a quote that is not the Ruby of the line is kept', () => {
                const map = dnclToRuby('a = 1').sourceMap;
                const text = 'Put the number part in parentheses, like "a" + (x - 1).';
                const [moved] = map.rubyErrorsToDncl([{ row: 0, column: 0, source: null, text }]);

                expect(moved.text).toBe(text);
            });
        });

        test('an error after the last Ruby line lands on the last DNCL line', () => {
            const dncl = 'a = 【外部からの入力】\nb = 2';
            const map = dnclToRuby(dncl).sourceMap;

            expect(map.rubyErrorsToDncl([{ row: 99, column: 0, text: 'eof' }])[0].row).toBe(1);
        });
    });
});
