/**
 * Ruby's `break` / `next` (and `redo` / `retry`) in a loop have no form in
 * the Japanese mode (issue #1716). With a modifier (`break if @i == 5`) the
 * keyword was not taken as a command, so going through the Japanese mode made
 * it a variable (`@break if @i == 5`), which changes the program. Now it stops
 * with the error of a command the Japanese mode does not have (issue #1679),
 * on its line, both ways, and a variable named `next` still goes back and
 * forth.
 */
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
import { UNSUPPORTED_COMMAND_ERROR_ID } from '../../../../src/lib/dncl/dncl-validator';
import { rubyToDncl } from '../../../../src/lib/dncl/ruby-to-dncl';

const lines = (...ls) => ls.join('\n');

const pick = (errors) =>
    errors
        .filter((err) => err.id === UNSUPPORTED_COMMAND_ERROR_ID)
        .map(({ line, column, name }) => ({ line, column, name }));

const rubyErrors = (ruby) => pick(rubyToDncl(ruby).errors);
const dnclErrors = (dncl) => pick(dnclToRuby(dncl).errors);

describe('Ruby → DNCL: break / next in a loop is told on its Ruby line (issue #1716)', () => {
    test('break with if in a counting loop', () => {
        expect(rubyErrors(lines('@i = 1', 'while @i <= 10', '  break if @i == 5', '  @i += 1', 'end'))).toEqual([
            { line: 3, column: 3, name: 'break' },
        ]);
    });

    test('next with unless in a while loop', () => {
        expect(
            rubyErrors(lines('@i = 0', 'while @i < 10', '  @i += 1', '  next unless @i > 5', '  puts(@i)', 'end')),
        ).toEqual([{ line: 4, column: 3, name: 'next' }]);
    });

    test('break and next alone on a line', () => {
        expect(
            rubyErrors(
                lines('@i = 0', 'while @i < 10', '  @i += 1', '  if @i == 3', '    next', '  end', '  break', 'end'),
            ),
        ).toEqual([
            { line: 5, column: 5, name: 'next' },
            { line: 7, column: 3, name: 'break' },
        ]);
    });

    test('redo and retry', () => {
        expect(
            rubyErrors(lines('@i = 0', 'while @i < 10', '  redo if @i == 3', '  retry if @i == 4', 'end')),
        ).toEqual([
            { line: 3, column: 3, name: 'redo' },
            { line: 4, column: 3, name: 'retry' },
        ]);
    });
});

describe('DNCL → Ruby: break / next stops with an error and makes no @break (issue #1716)', () => {
    test('break with if', () => {
        const { ruby, errors } = dnclToRuby(
            lines('i = 1', 'i <= 10 の間', '  break if i == 5', '  i += 1', 'を繰り返す'),
        );
        expect(pick(errors)).toEqual([{ line: 3, column: 3, name: 'break' }]);
        expect(ruby).toBeNull();
    });

    test('next with if after a DNCLv2 line number', () => {
        expect(
            dnclErrors(lines('(01) i = 1', '(02) i <= 10 の間:', '(03) ｜ i += 1', '(04) ⎿ next if i == 5')),
        ).toEqual([{ line: 4, column: 8, name: 'next' }]);
    });
});

describe('a variable named like the keyword (issue #1716)', () => {
    test('next and break as variables go back and forth', () => {
        const dncl = lines('next = 1', 'break ← next + 1', 'next += break', '表示する(next)');
        const { ruby, errors } = dnclToRuby(dncl);
        expect(errors).toEqual([]);
        expect(ruby).toContain('@next = 1');
        expect(rubyToDncl(ruby).errors).toEqual([]);
    });

    test('a variable named next at the head of a loop or a condition goes back and forth', () => {
        const ruby = lines(
            '@next = 1',
            'while @next < 10',
            '  @next += 1',
            'end',
            '@break = 1',
            'while @break <= 3',
            '  puts(@break)',
            '  @break += 1',
            'end',
            '@next == 1',
        );
        const { dncl, errors } = rubyToDncl(ruby);
        expect(errors).toEqual([]);
        expect(dncl).toContain('next < 10 の間');
        expect(dncl).toContain('break を 1 から 3 まで 1 ずつ増やしながら');
        const back = dnclToRuby(dncl);
        expect(back.errors).toEqual([]);
        expect(back.ruby).toBe(ruby);
    });

    test('a variable named next as the condition of a loop', () => {
        const { ruby, errors } = dnclToRuby(
            lines('next = true', 'next かつ true の間:', '  next = false', 'を繰り返す'),
        );
        expect(errors).toEqual([]);
        expect(ruby).toContain('while @next && true');
    });
});
