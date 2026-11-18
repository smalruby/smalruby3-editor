/**
 * Building the RubyAST from a JaAST and writing its Ruby (ja-notation, J1 of
 * docs/ruby-editor/converter-roadmap.md), with the table of Smalruby and with
 * a table of another Ruby system, to see that the library has no rule of its own.
 */
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
import { SMALRUBY_JA_NOTATION } from '../../../../src/lib/dncl/ja-notation-table';
import { jaToRuby } from '../../../../src/lib/ja-notation';

const smalruby = (source) => jaToRuby(source, SMALRUBY_JA_NOTATION);

describe('jaToRuby with the table of Smalruby', () => {
    test.each([
        ['x = 1', '@x = 1'],
        ['Data = [1, 2]\nx = Data[0]', '@_array_Data_ = [1, 2]\n@x = @_array_Data_[0]'],
        ['A = 3', '@_var_A_ = 3'],
        ['b = a ÷ 2 + 1', '@b = (@a / 2).to_i + 1'],
        ['b = -a ÷ 2', '@b = -((@a / 2).to_i)'],
        ['b = -絶対値(5)', '@b = -(5.abs)'],
        ['b = 整数(a ÷ 2)', '@b = (@a / 2).to_i'],
        ['表示する(a, "は", b + 1)', 'puts(@a.to_s + "は" + (@b + 1).to_s)'],
        ['x = not (a > 0 or b)', '@x = !(@a > 0 || @b)'],
        ['n = 【整数を入力】', 'ask("")\n@n = answer.to_i'],
        ['x = 平方根(9)', '@x = Math.sqrt(9)'],
    ])('%s', (ja, ruby) => {
        expect(smalruby(ja).ruby).toBe(ruby);
    });

    test('a counting loop becomes a while loop that adds the step', () => {
        const { ruby, jaLines } = smalruby('i を 3 から 1 まで 1 ずつ減らしながら繰り返す:\n⎿ 表示する(i)');
        expect(ruby).toBe('@i = 3\nwhile @i >= 1\n  puts(@i)\n  @i += -1\nend');
        expect(jaLines).toEqual([1, 1, 2, 2, 2]);
    });

    test('a loop on a `not` is an until loop', () => {
        expect(smalruby('not x の間繰り返す:\n  x = 真').ruby).toBe('until @x\n  @x = true\nend');
    });

    test('the parameters of a function are local variables', () => {
        expect(smalruby('関数 たす(a, b):\n    返す a + b + c').ruby).toBe(
            'def たす(a, b)\n  return a + b + @c\nend',
        );
    });

    test('a block that ends by its indent keeps the blank lines in it', () => {
        const { ruby, jaLines } = smalruby('もし a > 0 ならば:\n    a = 1\n\nb = 2');
        expect(ruby).toBe('if @a > 0\n  @a = 1\n\nend\n@b = 2');
        expect(jaLines).toEqual([1, 2, 3, 2, 4]);
    });

    test.each([
        ['move(10)', 'unknown-command'],
        ['差分(1, 2)', 'unknown-command'],
        ['bounce_if_on_edge', 'unknown-command'],
        ['含む(a, b, c)', 'bad-arguments'],
    ])('%s is an error (%s)', (ja, code) => {
        expect(smalruby(ja).errors[0].code).toBe(code);
    });

    // Known bugs of the current conversion, found by the golden (J0). The Ruby
    // is the same as now; the bugs are after it (the converter: #2167, #2168;
    // blocks → Japanese: #2166) and are fixed on the new path later.
    test.each([
        ['#2166', 'greet() を定義する:\n    表示する("hi")\ngreet'],
        ['#2167', '答え = たしざん(3, 4)\nたしざん(a, b) を定義する:\n    返す a + b'],
        ['#2168', '表示する(namae + "には「く」がある")'],
    ])('known bug %s: the Ruby is the same as the current conversion', (issue, ja) => {
        expect(smalruby(ja).ruby).toBe(dnclToRuby(ja).ruby);
    });
});

describe('jaToRuby with another table', () => {
    // A plain Ruby: local variables, `表示する` is `puts`, no input.
    const PLAIN = {
        functions: { 表示する: { build: (args, ruby) => ruby.send(null, 'puts', args) } },
    };

    test('the names and functions are what the table says', () => {
        expect(jaToRuby('x = 1\n表示する(x, 2)', PLAIN).ruby).toBe('x = 1\nputs(x, 2)');
    });

    test('a function not in the table is an error', () => {
        expect(jaToRuby('要素数(x)', PLAIN).errors[0]).toMatchObject({ code: 'unknown-command', line: 1 });
    });

    test('without a table of inputs, an input is an error', () => {
        expect(jaToRuby('x = 【外部からの入力】', PLAIN).errors[0].code).toBe('syntax');
    });
});
