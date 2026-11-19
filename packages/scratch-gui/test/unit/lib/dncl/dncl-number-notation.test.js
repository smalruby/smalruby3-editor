/**
 * Ruby's number notations that 共通テスト用プログラム表記 does not use (issue #1745):
 * a hex / binary / octal prefix (`0x5`, `0b101`, `0o17`), `_` between digits (`1_000`),
 * an exponent (`1e3`, `1.5e-3`) and the rational / imaginary suffixes (`3r`, `2i`).
 *
 * The Japanese mode writes numbers as the examples of the common test do (`123`, `0.5`),
 * so these are told as an error on their line. Converting them once put `@` inside the
 * number (`0@x5`, `1@_000`, `1@e3`), which is broken Ruby.
 */
import { dnclToRuby, rubyForLeavingDncl } from '../../../../src/lib/dncl/dncl-to-ruby';
import { UNSUPPORTED_NUMBER_ERROR_ID } from '../../../../src/lib/dncl/dncl-validator';
import { rubyToDncl } from '../../../../src/lib/dncl/ruby-to-dncl';
import { loadPrism } from '../../../../src/lib/prism-parser';

beforeAll(() => loadPrism());

const numberErrors = (errors) =>
    errors
        .filter((err) => err.id === UNSUPPORTED_NUMBER_ERROR_ID)
        .map(({ line, column, name }) => ({ line, column, name }));

describe('DNCL → Ruby: number notations the Japanese mode does not have (issue #1745)', () => {
    test.each([
        ['a = 0x5', '0x5', 5],
        ['a = 1_000', '1_000', 5],
        ['a = 1e3', '1e3', 5],
        ['a = 1.5e-3', '1.5e-3', 5],
        ['a = 2E+10', '2E+10', 5],
        ['a = 0b101', '0b101', 5],
        ['a = 0o17', '0o17', 5],
        ['a = 3r', '3r', 5],
        ['a = 2i', '2i', 5],
        ['表示する(0x1F)', '0x1F', 6],
        ['a = A[0x1]', '0x1', 7],
        ['a = 1..0x5', '0x5', 8],
    ])('%s is an error on its line and makes no Ruby', (dncl, name, column) => {
        const { ruby, errors } = dnclToRuby(dncl);
        expect(ruby).toBeNull();
        expect(numberErrors(errors)).toEqual([{ line: 1, column, name }]);
    });

    test('the error message tells how to write the number', () => {
        const [err] = dnclToRuby('a = 0x5').errors;
        expect(err.message).toContain('「0x5」');
        expect(err.message).toContain('Ruby モード');
    });

    test('the line number is the line of the DNCL source (line numbers and rules)', () => {
        const dncl = ['(1) a = 1', '(2) b = 1_000', '(3) 表示する(a + b)'].join('\n');
        expect(numberErrors(dnclToRuby(dncl).errors)).toEqual([{ line: 2, column: 9, name: '1_000' }]);
    });

    test('several numbers on a line are each told', () => {
        expect(numberErrors(rubyToDncl('@a = 0x5 + 1e3').errors)).toEqual([
            { line: 1, column: 6, name: '0x5' },
            { line: 1, column: 12, name: '1e3' },
        ]);
    });

    test.each([
        'a = 123',
        'a = 0.5',
        'a = 1.5 + 2',
        'a = -3',
        'x1 = 2',
        'a2b = x1 + 3',
        'a = 1.to_s',
        'a = 1..5',
        'a = rand(1..10)',
        'a = 10 ÷ 3',
        '表示する("0x5")',
        '表示する(「1e3」)',
        'a = 1 # 0x5',
        'i を 1 から 10 まで 1 ずつ増やしながら',
    ])('%s has no number error', (dncl) => {
        expect(numberErrors(dnclToRuby(dncl).errors)).toEqual([]);
    });

    test('decimal numbers still convert', () => {
        expect(dnclToRuby('a = 1.5 + 10').ruby).toBe('@a = 1.5 + 10');
    });

    test('leaving the Japanese mode keeps the last Ruby', () => {
        expect(rubyForLeavingDncl('a = 0x5', '@a = 0x5')).toBe('@a = 0x5');
    });
});

describe('Ruby → DNCL: the same numbers are told on the Ruby line (issue #1745)', () => {
    test.each([
        ['@a = 0x5', '0x5', 6],
        ['@a = 1_000', '1_000', 6],
        ['@a = 1e3', '1e3', 6],
        ['puts(0b101)', '0b101', 6],
    ])('%s', (ruby, name, column) => {
        const { errors } = rubyToDncl(ruby);
        expect(numberErrors(errors)).toEqual([{ line: 1, column, name }]);
    });

    test('the line is the Ruby line', () => {
        const { errors } = rubyToDncl(['@a = 1', 'puts(@a)', '@b = 1e3'].join('\n'));
        expect(numberErrors(errors)).toEqual([{ line: 3, column: 6, name: '1e3' }]);
    });

    test('decimal numbers and numbers in strings have no error', () => {
        expect(rubyToDncl('@a = 1.5\nputs("0x5")\n@b = 1.to_s # 1e3').errors).toEqual([]);
    });
});

describe('an integer with leading zeros (issue #1745)', () => {
    // DNCL reads `017` as 17, but Ruby reads it as octal 15 (and `08` is an error).
    test.each([
        ['a = 017', '@a = 17'],
        ['a = 08', '@a = 8'],
        ['a = 007 + 1', '@a = 7 + 1'],
        ['a = 00.5', '@a = 0.5'],
        ['a = A[01]', '@a = @_array_A_[1]'],
        ['Data = [1, 02, 3]', '@_array_Data_ = [1, 2, 3]'],
        ['a = 0', '@a = 0'],
        ['a = 0.5', '@a = 0.5'],
        ['a = 10 + 1.05', '@a = 10 + 1.05'],
        ['(01) a = 017', '@a = 17'],
    ])('DNCL %s is the decimal number in Ruby', (dncl, ruby) => {
        expect(dnclToRuby(dncl)).toMatchObject({ ruby, errors: [] });
    });

    test('the loop bounds are decimal numbers too', () => {
        expect(dnclToRuby('i を 01 から 010 まで 1 ずつ増やしながら繰り返す:\n    表示する(i)').ruby).toContain(
            '@i = 1\nwhile @i <= 10',
        );
    });

    test.each([
        ['@a = 017', '017', 6],
        ['@a = 017.to_s', '017', 6],
    ])('Ruby %s (octal) is an error on its line', (ruby, name, column) => {
        expect(numberErrors(rubyToDncl(ruby).errors)).toEqual([{ line: 1, column, name }]);
    });

    test.each(['@a = 0', '@a = 0.5', '@a = 10', '@a = 1.05', '@a01 = 1', 'puts("017")'])(
        'Ruby %s has no number error',
        (ruby) => {
            expect(rubyToDncl(ruby).errors).toEqual([]);
        },
    );

    test('Ruby @a = 08 is not Ruby (8 is no octal digit): it is told as an error of the Ruby', () => {
        const { errors } = rubyToDncl('@a = 08');
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toContain('Ruby のプログラムに誤りがある');
    });

    test('the DNCL does not tell leading zeros (they become decimal)', () => {
        expect(numberErrors(dnclToRuby('a = 017').errors)).toEqual([]);
        expect(dnclToRuby('a = 017').ruby).toBe('@a = 17');
    });
});

// Full-width digits differ only in how they look, so they are read as the digits; a name right
// after a number is not read as a product but told on its line (issue #1752).
describe('DNCL → Ruby: full-width digits and a name right after a number (issue #1752)', () => {
    test.each([
        ['a = １２', '@a = 12'],
        ['a = ３．５', '@a = 3.5'],
        ['a = 0１', '@a = 1'],
        ['i を １ から １０ まで １ ずつ増やしながら繰り返す:\n    表示する(i)', null],
    ])('%s is read with half-width digits', (dncl, ruby) => {
        const result = dnclToRuby(dncl);
        expect(result.errors).toEqual([]);
        if (ruby) expect(result.ruby).toBe(ruby);
        else expect(result.ruby).not.toMatch(/[０-９]/);
    });

    // The full-width letters and digits are made half-width, in a name too (W8 of the EPIC #1731).
    test('full-width letters and digits in a name are read as the half-width ones', () => {
        expect(dnclToRuby('x１ = 1\nｘ１ = x１ + 1').ruby).toBe('@x1 = 1\n@x1 = @x1 + 1');
    });

    test('full-width letters and digits in a string and a comment are kept', () => {
        expect(dnclToRuby('表示する("ｘ１")  # ｘ１ を表示する').ruby).toBe('console.puts("ｘ１") # ｘ１ を表示する');
    });

    test.each([
        ['a = 2倍', '2倍', 6],
        ['a = 10回', '10回', 7],
        ['表示する(3個)', '3個', 7],
    ])('%s makes no Ruby and tells to write an operator', (dncl, written, column) => {
        const { ruby, errors } = dnclToRuby(dncl);
        expect(ruby).toBeNull();
        expect(errors).toHaveLength(1);
        expect(errors[0]).toMatchObject({ line: 1, column });
        expect(errors[0].message).toContain(`「${written}」は読めません。数と名前の間には`);
    });
});
