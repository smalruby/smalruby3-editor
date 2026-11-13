/**
 * Ruby's number notations that 共通テスト用プログラム表記 does not use (issue #1745):
 * a hex / binary / octal prefix (`0x5`, `0b101`, `0o17`), `_` between digits (`1_000`),
 * an exponent (`1e3`, `1.5e-3`) and the rational / imaginary suffixes (`3r`, `2i`).
 *
 * The Japanese mode writes numbers as the examples of the common test do (`123`, `0.5`),
 * so these are told as an error on their line. Converting them once put `@` inside the
 * number (`0@x5`, `1@_000`, `1@e3`), which is broken Ruby.
 */
import { processSegments } from '../../../../src/lib/dncl/dncl-identifier-converter';
import { dnclToRuby, rubyForLeavingDncl } from '../../../../src/lib/dncl/dncl-to-ruby';
import {
    findUnsupportedNumbers,
    UNSUPPORTED_NUMBER_ERROR_ID,
    validateDncl,
} from '../../../../src/lib/dncl/dncl-validator';
import { rubyToDncl } from '../../../../src/lib/dncl/ruby-to-dncl';

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
        const [err] = validateDncl('a = 0x5');
        expect(err.message).toContain('「0x5」');
        expect(err.message).toContain('Ruby モード');
    });

    test('the line number is the line of the DNCL source (line numbers and rules)', () => {
        const dncl = ['(1) a = 1', '(2) b = 1_000', '(3) 表示する(a + b)'].join('\n');
        expect(numberErrors(dnclToRuby(dncl).errors)).toEqual([{ line: 2, column: 9, name: '1_000' }]);
    });

    test('several numbers on a line are each told', () => {
        expect(findUnsupportedNumbers('a = 0x5 + 1e3').map(({ column, name }) => ({ column, name }))).toEqual([
            { column: 5, name: '0x5' },
            { column: 11, name: '1e3' },
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
        expect(findUnsupportedNumbers(dncl)).toEqual([]);
    });

    test('decimal numbers still convert', () => {
        expect(dnclToRuby('a = 1.5 + 10').ruby).toBe('@a = 1.5 + 10');
    });

    test('leaving the Japanese mode keeps the last Ruby', () => {
        expect(rubyForLeavingDncl('a = 0x5', '@a = 0x5')).toBe('@a = 0x5');
    });
});

describe('the name conversion does not go inside a number (issue #1745)', () => {
    test.each([
        ['a = 0x5', '@a = 0x5'],
        ['a = 1_000', '@a = 1_000'],
        ['a = 1e3', '@a = 1e3'],
        ['a = 1.5e-3 + b', '@a = 1.5e-3 + @b'],
        ['a = A[0x1]', '@a = @_array_A_[0x1]'],
        ['a = x1 + 2', '@a = @x1 + 2'],
    ])('%s', (dncl, ruby) => {
        expect(processSegments(dncl)).toBe(ruby);
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
