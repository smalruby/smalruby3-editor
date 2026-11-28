import { rubyToDncl } from '../../../../src/lib/dncl/ruby-to-dncl';
import { loadPrism } from '../../../../src/lib/prism-parser';

beforeAll(() => loadPrism());

describe('rubyToDncl', () => {
    const convert = (code) => rubyToDncl(code).dncl;

    describe('variable assignment', () => {
        test('lowercase variable', () => {
            expect(convert('@a = 3')).toBe('a = 3');
        });

        test('uppercase scalar variable', () => {
            expect(convert('@_var_A_ = 3')).toBe('A = 3');
        });

        test('uppercase array variable', () => {
            expect(convert('@_array_Kouka_ = [1, 5, 10]')).toBe('Kouka = [1, 5, 10]');
        });

        test('variable reference in expression', () => {
            expect(convert('@a = @_var_A_ + 1')).toBe('a = A + 1');
        });
    });

    describe('operators', () => {
        test('logical &&', () => {
            expect(convert('@a = @x && @y')).toBe('a = x and y');
        });

        test('logical ||', () => {
            expect(convert('@a = @x || @y')).toBe('a = x or y');
        });

        test('logical !', () => {
            expect(convert('@a = !@x')).toBe('a = not x');
        });

        test('boolean true', () => {
            expect(convert('@a = true')).toBe('a = 真');
        });

        test('boolean false', () => {
            expect(convert('@a = false')).toBe('a = 偽');
        });
    });

    describe('display and input', () => {
        test('say → 表示する', () => {
            expect(convert('say(@a, 1)')).toBe('表示する(a)');
        });

        test('say with multiple args', () => {
            expect(convert('say(@a, @b, @c, 1)')).toBe('表示する(a, b, c)');
        });

        test('console.puts (the console block) → 表示する (#1758)', () => {
            expect(convert('console.puts(@a)')).toBe('表示する(a)');
            expect(convert('console.puts(@a.to_s + "は" + @b.to_s)')).toBe('表示する(a, "は", b)');
        });

        test('console.gets (the console block) → 入力 (#1758)', () => {
            expect(convert('@a = console.gets')).toBe('a = 【外部からの入力】');
            expect(convert('@n = console.gets.to_i')).toBe('n = 【整数を入力】');
        });

        test('console.gets that is not the value of an assignment has no Japanese form', () => {
            expect(rubyToDncl('console.puts(console.gets)').errors).not.toEqual([]);
        });

        test('ask + answer → 入力', () => {
            expect(convert('ask("")\n@a = answer')).toBe('a = 【外部からの入力】');
        });

        test('ask + answer.to_i → 整数を入力 (Issue #1186)', () => {
            expect(convert('ask("")\n@n = answer.to_i')).toBe('n = 【整数を入力】');
        });

        test('ask_and_wait + answer → 入力 (legacy)', () => {
            expect(convert('ask_and_wait("")\n@a = answer')).toBe('a = 【外部からの入力】');
        });

        test('puts → 表示する', () => {
            expect(convert('puts(@a)')).toBe('表示する(a)');
        });

        test('print → 表示する', () => {
            expect(convert('print(@a)')).toBe('表示する(a)');
        });

        test('p → 表示する', () => {
            expect(convert('p(@a)')).toBe('表示する(a)');
        });
    });

    describe('built-in functions', () => {
        test('.to_i → 整数()', () => {
            expect(convert('@a = @x.to_i')).toBe('a = 整数(x)');
        });

        test('.to_s → 文字列()', () => {
            expect(convert('@a = @x.to_s')).toBe('a = 文字列(x)');
        });

        test('rand() → 乱数()', () => {
            expect(convert('@a = rand(10)')).toBe('a = 乱数(10)');
        });

        test('.length → 要素数()', () => {
            expect(convert('@a = @_array_Kouka_.length')).toBe('a = 要素数(Kouka)');
        });

        test('.round → 四捨五入()', () => {
            expect(convert('@a = @x.round')).toBe('a = 四捨五入(x)');
        });

        test('.floor → 切り捨て()', () => {
            expect(convert('@a = @x.floor')).toBe('a = 切り捨て(x)');
        });

        test('.ceil → 切り上げ()', () => {
            expect(convert('@a = @x.ceil')).toBe('a = 切り上げ(x)');
        });

        test('.abs → 絶対値()', () => {
            expect(convert('@a = @x.abs')).toBe('a = 絶対値(x)');
        });

        test('Math.sqrt() → 平方根()', () => {
            expect(convert('@a = Math.sqrt(@x)')).toBe('a = 平方根(x)');
        });

        test('.include?() → 含む()', () => {
            expect(convert('@a = @x.include?("ell")')).toBe('a = 含む(x, "ell")');
        });
    });

    describe('nested same-name calls', () => {
        test('rand(rand(rand(1..10))) fully converts', () => {
            expect(convert('puts(rand(rand(rand(1..10))))')).toBe('表示する(乱数(乱数(乱数(1..10))))');
        });

        test('puts(puts(x)) fully converts', () => {
            expect(convert('puts(puts(@x))')).toBe('表示する(表示する(x))');
        });

        test('p(p(x)) fully converts', () => {
            expect(convert('p(p(@x))')).toBe('表示する(表示する(x))');
        });

        test('say with nested same-name in args', () => {
            // say uses splitArgsAtTopLevel; rand(rand(...)) is recognized as a
            // single argument and the trailing duration `, 1` is stripped.
            expect(convert('say(rand(rand(1..10)), 1)')).toBe('表示する(乱数(乱数(1..10)))');
        });

        test('p does not match part of map(', () => {
            // The standalone check ensures map( does not become 表示する(ap(...))
            expect(convert('@a = @arr.map(&:to_s)')).toBe('a = @arr.map(&:to_s)');
        });
    });

    describe('display: say with any duration', () => {
        test('say with 1 second', () => {
            expect(convert('say(@a, 1)')).toBe('表示する(a)');
        });

        test('say with 2 seconds', () => {
            expect(convert('say(@a, 2)')).toBe('表示する(a)');
        });

        test('say with 0.5 seconds', () => {
            expect(convert('say(@a, 0.5)')).toBe('表示する(a)');
        });
    });

    describe('control flow: until', () => {
        test('until loop converts to not ... の間繰り返す', () => {
            expect(convert('until @a > 10\n  @a = @a + 1\nend')).toBe('not a > 10 の間繰り返す:\n    a = a + 1');
        });

        // The generator writes an empty "repeat until" as `until x do` / `end` (issue #1655).
        test('the do of an empty until / while is dropped', () => {
            expect(convert('until @a > 10 do\nend')).toBe('not a > 10 の間繰り返す:\nを繰り返す');
            expect(convert('while @a > 10 do\nend')).toBe('a > 10 の間繰り返す:\nを繰り返す');
        });
    });

    describe('control flow: N.times', () => {
        test('N.times converts to for loop', () => {
            expect(convert('10.times do\n  @a = @a + 1\nend')).toBe(
                'i を 1 から 10 まで 1 ずつ増やしながら繰り返す:\n    a = a + 1',
            );
        });
    });

    describe('control flow: if', () => {
        test('simple if', () => {
            expect(convert('if @a > 0\n  @a = 1\nend')).toBe('もし a > 0 ならば:\n    a = 1');
        });

        test('if-else', () => {
            expect(convert('if @a > 0\n  @a = 1\nelse\n  @a = 2\nend')).toBe(
                'もし a > 0 ならば:\n    a = 1\nそうでなければ:\n    a = 2',
            );
        });

        test('if-elsif-else', () => {
            expect(convert('if @a > 0\n  @a = 1\nelsif @a > 5\n  @a = 2\nelse\n  @a = 3\nend')).toBe(
                'もし a > 0 ならば:\n    a = 1\nそうでなくもし a > 5 ならば:\n    a = 2\nそうでなければ:\n    a = 3',
            );
        });
    });

    describe('control flow: for loop (step syntax)', () => {
        test('ascending step for loop', () => {
            expect(convert('(1..10).step(1) do |i|\n  say(@i, 1)\nend')).toBe(
                'i を 1 から 10 まで 1 ずつ増やしながら繰り返す:\n    表示する(i)',
            );
        });

        test('descending step for loop', () => {
            expect(convert('10.step(0, -1) do |i|\n  say(@i, 1)\nend')).toBe(
                'i を 10 から 0 まで 1 ずつ減らしながら繰り返す:\n    表示する(i)',
            );
        });
    });

    describe('control flow: for loop (while pattern)', () => {
        test('ascending while-based for loop', () => {
            const ruby = '@i = 1\nwhile @i <= 10\n  say(@i, 1)\n  @i += 1\nend';
            expect(convert(ruby)).toBe('i を 1 から 10 まで 1 ずつ増やしながら繰り返す:\n    表示する(i)');
        });

        test('descending while-based for loop', () => {
            const ruby = '@i = 10\nwhile @i >= 0\n  say(@i, 1)\n  @i += -1\nend';
            expect(convert(ruby)).toBe('i を 10 から 0 まで 1 ずつ減らしながら繰り返す:\n    表示する(i)');
        });

        test('ascending while-based for loop with step 2', () => {
            const ruby = '@i = 0\nwhile @i <= @n\n  say(@i, 1)\n  @i += 2\nend';
            expect(convert(ruby)).toBe('i を 0 から n まで 2 ずつ増やしながら繰り返す:\n    表示する(i)');
        });

        test('nested while-based for loops', () => {
            const ruby = [
                '@i = 1',
                'while @i <= 3',
                '  @j = 1',
                '  while @j <= 3',
                '    say(@i, 1)',
                '    @j += 1',
                '  end',
                '  @i += 1',
                'end',
            ].join('\n');
            const dncl = [
                'i を 1 から 3 まで 1 ずつ増やしながら繰り返す:',
                '    j を 1 から 3 まで 1 ずつ増やしながら繰り返す:',
                '        表示する(i)',
            ].join('\n');
            expect(convert(ruby)).toBe(dncl);
        });
    });

    describe('control flow: while loop', () => {
        test('while loop', () => {
            expect(convert('while @a > 0\n  @a = @a - 1\nend')).toBe('a > 0 の間繰り返す:\n    a = a - 1');
        });
    });

    describe('control flow: function', () => {
        test('function definition', () => {
            expect(convert('def f(x)\n  return @x * 2\nend')).toBe('関数 f(x):\n    x * 2 を返す');
        });
    });

    describe('CJK variable names', () => {
        test('kanji variable assignment', () => {
            expect(convert('@合計 = 0')).toBe('合計 = 0');
        });

        test('kanji variable reference in expression', () => {
            expect(convert('@合計 = @合計 + @i')).toBe('合計 = 合計 + i');
        });

        test('hiragana variable', () => {
            expect(convert('@けっか = 1')).toBe('けっか = 1');
        });

        test('katakana variable', () => {
            expect(convert('@カウント = 0')).toBe('カウント = 0');
        });

        test('negation of CJK variable', () => {
            expect(convert('if !@合計\n  @a = 1\nend')).toBe('もし not 合計 ならば:\n    a = 1');
        });

        test('CJK uppercase scalar variable', () => {
            expect(convert('@_var_合計_ = 0')).toBe('合計 = 0');
        });

        test('CJK uppercase array variable', () => {
            expect(convert('@_array_配列_ = [1, 2, 3]')).toBe('配列 = [1, 2, 3]');
        });
    });

    describe('CJK for-loop (while pattern)', () => {
        test('for-loop with CJK body variable', () => {
            const ruby = ['@合計 = 0', '@i = 1', 'while @i <= 10', '  @合計 += @i', '  @i += 1', 'end'].join('\n');
            const dncl = ['合計 = 0', 'i を 1 から 10 まで 1 ずつ増やしながら繰り返す:', '    合計 += i'].join('\n');
            expect(convert(ruby)).toBe(dncl);
        });

        test('for-loop with CJK loop variable', () => {
            const ruby = ['@回数 = 1', 'while @回数 <= 5', '  say(@回数, 1)', '  @回数 += 1', 'end'].join('\n');
            const dncl = ['回数 を 1 から 5 まで 1 ずつ増やしながら繰り返す:', '    表示する(回数)'].join('\n');
            expect(convert(ruby)).toBe(dncl);
        });
    });

    describe('CJK built-in methods', () => {
        test('.to_i on CJK variable', () => {
            expect(convert('@a = @合計.to_i')).toBe('a = 整数(合計)');
        });

        test('.to_s on CJK variable', () => {
            expect(convert('@a = @合計.to_s')).toBe('a = 文字列(合計)');
        });

        test('.length on CJK variable', () => {
            expect(convert('@a = @配列.length')).toBe('a = 要素数(配列)');
        });

        test('.round on CJK variable', () => {
            expect(convert('@a = @平均.round')).toBe('a = 四捨五入(平均)');
        });

        test('.abs on CJK variable', () => {
            expect(convert('@a = @差分.abs')).toBe('a = 絶対値(差分)');
        });

        test('.include? on CJK variable', () => {
            expect(convert('@a = @文字列.include?("ell")')).toBe('a = 含む(文字列, "ell")');
        });
    });

    describe('CJK roundtrip: reported bug', () => {
        test('DNCL program with 合計 variable roundtrips correctly', () => {
            const ruby = [
                '@合計 = 0',
                '@i = 1',
                'while @i <= 10',
                '  @合計 += @i',
                '  @i += 1',
                'end',
                'say(@合計, 1)',
            ].join('\n');
            const expectedDncl = [
                '合計 = 0',
                'i を 1 から 10 まで 1 ずつ増やしながら繰り返す:',
                '    合計 += i',
                '表示する(合計)',
            ].join('\n');
            expect(convert(ruby)).toBe(expectedDncl);
        });
    });

    describe('comments', () => {
        test('preserves comments', () => {
            expect(convert('# コメント')).toBe('# コメント');
        });
    });

    describe('multiline', () => {
        test('preserves blank lines', () => {
            expect(convert('@a = 1\n\n@b = 2')).toBe('a = 1\n\nb = 2');
        });
    });

    // Japanese typed in the Ruby tab is not Ruby: it is told by its syntax errors only, not by
    // an error of the Japanese mode for each of its words (Issue #2547).
    describe('Ruby that prism cannot read', () => {
        test('tells only the syntax errors', () => {
            const { errors } = rubyToDncl('a = 1\nもし a > 1 ならば:\n    表示する(a)\nf(1)\n');
            expect(errors.length).toBeGreaterThan(0);
            errors.forEach((error) => {
                expect(error.id).toBe('rubySyntax');
                expect(error.message).toMatch(/^Ruby のプログラムに誤りがあるので、日本語にできません/);
            });
        });

        test('readable Ruby still tells the words with no Japanese form', () => {
            const { errors } = rubyToDncl('move(10)\n');
            expect(errors).toEqual([expect.objectContaining({ id: 'unsupportedCommand', name: 'move' })]);
        });
    });
});
