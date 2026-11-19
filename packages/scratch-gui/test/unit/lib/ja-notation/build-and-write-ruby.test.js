/**
 * Building the RubyAST from a JaAST and writing its Ruby (ja-notation, J1 and J2
 * of docs/ruby-editor/converter-roadmap.md) with the table of Smalruby. The
 * library with no table and with a table of another Ruby system is tested in
 * packages/ja-notation/ (its JSON test data).
 */
import { jaToRuby } from '@smalruby/ja-notation';
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
import { SMALRUBY_JA_NOTATION } from '../../../../src/lib/dncl/ja-notation-table';

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
        ['表示する(a, "は", b + 1)', 'console.puts(@a.to_s + "は" + (@b + 1).to_s)'],
        ['x = not (a > 0 or b)', '@x = !(@a > 0 || @b)'],
        ['n = 【整数を入力】', '@n = console.gets.to_i'],
        ['x = 平方根(9)', '@x = Math.sqrt(9)'],
    ])('%s', (ja, ruby) => {
        expect(smalruby(ja).ruby).toBe(ruby);
    });

    test('a counting loop becomes a while loop that adds the step', () => {
        const { ruby, jaLines } = smalruby('i を 3 から 1 まで 1 ずつ減らしながら繰り返す:\n⎿ 表示する(i)');
        expect(ruby).toBe('@i = 3\nwhile @i >= 1\n  console.puts(@i)\n  @i += -1\nend');
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

    test('a block that ends by its indent puts the blank lines after its end', () => {
        const { ruby, jaLines } = smalruby('もし a > 0 ならば:\n    a = 1\n\nb = 2');
        expect(ruby).toBe('if @a > 0\n  @a = 1\nend\n\n@b = 2');
        expect(jaLines).toEqual([1, 2, 2, 3, 4]);
    });

    test('a block closed by a line of its own has its end on that line', () => {
        const { ruby, jaLines } = smalruby('もし a > 0 ならば\n  a = 1\n\nを実行する # c\nb = 2');
        expect(ruby).toBe('if @a > 0\n  @a = 1\n\nend # c\n@b = 2');
        expect(jaLines).toEqual([1, 2, 3, 4, 5]);
    });

    test('a counting loop closed by `を繰り返す` adds the step on that line', () => {
        const { ruby, jaLines } = smalruby('i を 3 から 1 まで -1 ずつ減らしながら\n  表示する(i)\nを繰り返す');
        expect(ruby).toBe('@i = 3\nwhile @i >= 1\n  console.puts(@i)\n  @i += -(-1)\nend');
        expect(jaLines).toEqual([1, 1, 2, 3, 3]);
    });

    // The current conversion adds the step only at `を繰り返す`, so a counting
    // loop closed by `を実行する` never ends there; here every closing line adds it.
    // The closing word must be the one of the block (W3 of the EPIC #1731).
    test('a counting loop closed by another closing word is an error', () => {
        const result = smalruby('i を 1 から 3 まで 1 ずつ増やしながら\n  表示する(i)\nを実行する');
        expect(result.ruby).toBeNull();
        expect(result.errors).toMatchObject([{ block: 'closer-kind', line: 3, expected: 'を繰り返す' }]);
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
