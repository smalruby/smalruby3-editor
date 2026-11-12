import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
import { rubyToDncl } from '../../../../src/lib/dncl/ruby-to-dncl';

/**
 * A `while` after `@i = from` becomes a counting loop header in DNCL
 * (`i を 1 から 10 まで 1 ずつ増やしながら`) only when the last line of the
 * body adds a constant step to the variable. Any other shape stays as the
 * `の間` loop, and no placeholder is left in the DNCL (Issue #1695).
 */
const toDncl = (ruby) => rubyToDncl(ruby).dncl;
const toRuby = (dncl) => dnclToRuby(dncl).ruby;

const PLACEHOLDER = '__FOR_HEADER_PLACEHOLDER__';

/**
 * Ruby → DNCL → Ruby keeps the Ruby, and DNCL → Ruby → DNCL keeps the DNCL.
 * @param {string} ruby - The Ruby source.
 * @param {string} dncl - The DNCL it becomes.
 */
const expectBothWays = (ruby, dncl) => {
    const gotDncl = toDncl(ruby);
    expect(gotDncl).not.toContain(PLACEHOLDER);
    expect(gotDncl).toBe(dncl);
    expect(toRuby(gotDncl)).toBe(ruby);
    expect(toDncl(toRuby(dncl))).toBe(dncl);
};

describe('counting while loop (Issue #1695)', () => {
    describe('stays a の間 loop', () => {
        test('the increment is not the last line (the example of the issue)', () => {
            expectBothWays(
                ['@i = 1', 'while @i <= 10', '  @i += 1', '  puts(@i)', 'end'].join('\n'),
                ['i = 1', 'i <= 10 の間', '  i += 1', '  表示する(i)', 'を繰り返す'].join('\n'),
            );
        });

        test('the variable is incremented twice', () => {
            expectBothWays(
                ['@i = 1', 'while @i <= 10', '  @i += 1', '  puts(@i)', '  @i += 1', 'end'].join('\n'),
                ['i = 1', 'i <= 10 の間', '  i += 1', '  表示する(i)', '  i += 1', 'を繰り返す'].join('\n'),
            );
        });

        test('the variable is changed in the middle of the body', () => {
            expectBothWays(
                ['@i = 1', 'while @i <= 10', '  @i = @i * 2', '  puts(@i)', '  @i += 1', 'end'].join('\n'),
                ['i = 1', 'i <= 10 の間', '  i = i * 2', '  表示する(i)', '  i += 1', 'を繰り返す'].join('\n'),
            );
        });

        test('the step uses the variable itself', () => {
            expectBothWays(
                ['@i = 1', 'while @i <= 100', '  puts(@i)', '  @i += @i', 'end'].join('\n'),
                ['i = 1', 'i <= 100 の間', '  表示する(i)', '  i += i', 'を繰り返す'].join('\n'),
            );
        });

        test('the step is a variable changed in the body', () => {
            expectBothWays(
                ['@i = 1', 'while @i <= 100', '  @k += 1', '  @i += @k', 'end'].join('\n'),
                ['i = 1', 'i <= 100 の間', '  k += 1', '  i += k', 'を繰り返す'].join('\n'),
            );
        });

        test('the step goes the other way than the condition', () => {
            const ruby = ['@i = 1', 'while @i <= 10', '  puts(@i)', '  @i -= 1', 'end'].join('\n');
            const dncl = toDncl(ruby);
            expect(dncl).not.toContain(PLACEHOLDER);
            expect(dncl).toBe(['i = 1', 'i <= 10 の間', '  表示する(i)', '  i -= 1', 'を繰り返す'].join('\n'));
        });

        test('the step calls a method', () => {
            const dncl = toDncl(['@i = 1', 'while @i <= 10', '  puts(@i)', '  @i += rand(3)', 'end'].join('\n'));
            expect(dncl).not.toContain(PLACEHOLDER);
            expect(dncl.split('\n').slice(0, 2)).toEqual(['i = 1', 'i <= 10 の間']);
        });

        test('the variable is the first of a multiple assignment', () => {
            expectBothWays(
                ['@i = 1', 'while @i <= 10', '  @i, @j = 5, 0', '  @i += 1', 'end'].join('\n'),
                ['i = 1', 'i <= 10 の間', '  i, j = 5, 0', '  i += 1', 'を繰り返す'].join('\n'),
            );
        });

        test('the negated step is more than one operand', () => {
            expectBothWays(
                ['@i = 10', 'while @i >= 1', '  puts(@i)', '  @i += -(@a) + 1', 'end'].join('\n'),
                ['i = 10', 'i >= 1 の間', '  表示する(i)', '  i += -(a) + 1', 'を繰り返す'].join('\n'),
            );
        });

        test('the increment is in an if at the end of the body', () => {
            expectBothWays(
                ['@i = 1', 'while @i <= 10', '  if @i > 0', '    @i += 1', '  end', 'end'].join('\n'),
                ['i = 1', 'i <= 10 の間', '  もし i > 0 ならば', '    i += 1', '  を実行する', 'を繰り返す'].join(
                    '\n',
                ),
            );
        });

        test('with comments at the end of lines', () => {
            expectBothWays(
                ['@i = 1 # a', 'while @i <= 10 # b', '  @i += 1 # c', '  puts(@i) # d', 'end # e'].join('\n'),
                ['i = 1 # a', 'i <= 10 の間 # b', '  i += 1 # c', '  表示する(i) # d', 'を繰り返す # e'].join('\n'),
            );
        });
    });

    describe('becomes a counting loop', () => {
        test('the increment is the last line (unchanged)', () => {
            expectBothWays(
                ['@i = 1', 'while @i <= 10', '  puts(@i)', '  @i += 1', 'end'].join('\n'),
                ['i を 1 から 10 まで 1 ずつ増やしながら', '  表示する(i)', 'を繰り返す'].join('\n'),
            );
        });

        test('-= at the end of the body (the comment of the issue)', () => {
            const ruby = ['@i = 10', 'while @i >= 1', '  puts(@i)', '  @i -= 1', 'end'].join('\n');
            const dncl = ['i を 10 から 1 まで 1 ずつ減らしながら', '  表示する(i)', 'を繰り返す'].join('\n');
            expect(toDncl(ruby)).toBe(dncl);
            // DNCL → Ruby writes the decrement as `+= -1`.
            expect(toRuby(dncl)).toBe(['@i = 10', 'while @i >= 1', '  puts(@i)', '  @i += -1', 'end'].join('\n'));
            expect(toDncl(toRuby(dncl))).toBe(dncl);
        });

        test('@i = @i + 2 at the end of the body', () => {
            const ruby = ['@i = 1', 'while @i <= 10', '  puts(@i)', '  @i = @i + 2', 'end'].join('\n');
            expect(toDncl(ruby)).toBe(
                ['i を 1 から 10 まで 2 ずつ増やしながら', '  表示する(i)', 'を繰り返す'].join('\n'),
            );
        });

        test('@i = @i - 1 at the end of the body', () => {
            const ruby = ['@i = 10', 'while @i >= 1', '  puts(@i)', '  @i = @i - 1', 'end'].join('\n');
            expect(toDncl(ruby)).toBe(
                ['i を 10 から 1 まで 1 ずつ減らしながら', '  表示する(i)', 'を繰り返す'].join('\n'),
            );
        });

        test('a step variable not changed in the body', () => {
            expectBothWays(
                ['@i = 0', 'while @i <= 10', '  puts(@i)', '  @i += @s', 'end'].join('\n'),
                ['i を 0 から 10 まで s ずつ増やしながら', '  表示する(i)', 'を繰り返す'].join('\n'),
            );
        });

        test('a step expression not changed in the body', () => {
            expectBothWays(
                ['@i = 0', 'while @i <= 10', '  puts(@i)', '  @i += @s.to_i', 'end'].join('\n'),
                ['i を 0 から 10 まで 整数(s) ずつ増やしながら', '  表示する(i)', 'を繰り返す'].join('\n'),
            );
        });

        test('-= with a step of two terms', () => {
            const ruby = ['@i = 10', 'while @i >= 1', '  puts(@i)', '  @i -= @a + 1', 'end'].join('\n');
            const dncl = ['i を 10 から 1 まで a + 1 ずつ減らしながら', '  表示する(i)', 'を繰り返す'].join('\n');
            expect(toDncl(ruby)).toBe(dncl);
            expect(toDncl(toRuby(dncl))).toBe(dncl);
        });

        test('blank lines before end', () => {
            const ruby = ['@i = 1', 'while @i <= 10', '  puts(@i)', '  @i += 1', '', '', 'end'].join('\n');
            const dncl = ['i を 1 から 10 まで 1 ずつ増やしながら', '  表示する(i)', '', '', 'を繰り返す'].join('\n');
            expect(toDncl(ruby)).toBe(dncl);
            expect(toDncl(toRuby(dncl))).toBe(dncl);
        });

        test('a step of integer division', () => {
            expectBothWays(
                ['@i = 0', 'while @i <= 10', '  puts(@i)', '  @i += (@s / 2).to_i', 'end'].join('\n'),
                ['i を 0 から 10 まで s ÷ 2 ずつ増やしながら', '  表示する(i)', 'を繰り返す'].join('\n'),
            );
            expectBothWays(
                ['@i = 10', 'while @i >= 0', '  puts(@i)', '  @i += -(@s / 2).to_i', 'end'].join('\n'),
                ['i を 10 から 0 まで s ÷ 2 ずつ減らしながら', '  表示する(i)', 'を繰り返す'].join('\n'),
            );
        });

        test('a body indented by four spaces', () => {
            const dncl = ['i を 1 から 10 まで 1 ずつ増やしながら', '    表示する(i)', 'を繰り返す'].join('\n');
            expect(toDncl(toRuby(dncl))).toBe(dncl);
        });

        test('with comments at the end of lines', () => {
            const ruby = ['@i = 1 # a', 'while @i <= 10 # b', '  puts(@i) # c', '  @i += 1 # d', 'end # e'].join(
                '\n',
            );
            const dncl = [
                'i を 1 から 10 まで 1 ずつ増やしながら # a # b',
                '  表示する(i) # c',
                'を繰り返す # d # e',
            ].join('\n');
            expect(toDncl(ruby)).toBe(dncl);
            // The header and the closer each hold the comments of two Ruby lines.
            expect(toDncl(toRuby(dncl))).toBe(dncl);
        });
    });

    describe('a decreasing step of more than one term (DNCL → Ruby)', () => {
        test.each([
            ['a + 1', '-(@a + 1)'],
            ['a * 2', '-(@a * 2)'],
            ['-1', '-(-1)'],
            ['a', '-@a'],
            ['2', '-2'],
            ['整数(a / 2)', '-(@a / 2).to_i'],
        ])('%s ずつ減らしながら adds %s', (step, rubyStep) => {
            const dncl = [`i を 10 から 1 まで ${step} ずつ減らしながら`, '  表示する(i)', 'を繰り返す'].join('\n');
            expect(toRuby(dncl)).toBe(
                ['@i = 10', 'while @i >= 1', '  puts(@i)', `  @i += ${rubyStep}`, 'end'].join('\n'),
            );
        });

        test('it comes back as the same DNCL', () => {
            const dncl = ['i を 10 から 1 まで a + 1 ずつ減らしながら', '  表示する(i)', 'を繰り返す'].join('\n');
            expect(toDncl(toRuby(dncl))).toBe(dncl);
        });
    });

    describe('nested while loops', () => {
        test('only the inner increment is not the last line', () => {
            expectBothWays(
                [
                    '@i = 1',
                    'while @i <= 3',
                    '  @j = 1',
                    '  while @j <= 3',
                    '    @j += 1',
                    '    puts(@j)',
                    '  end',
                    '  @i += 1',
                    'end',
                ].join('\n'),
                [
                    'i を 1 から 3 まで 1 ずつ増やしながら',
                    '  j = 1',
                    '  j <= 3 の間',
                    '    j += 1',
                    '    表示する(j)',
                    '  を繰り返す',
                    'を繰り返す',
                ].join('\n'),
            );
        });

        test('only the outer increment is not the last line', () => {
            expectBothWays(
                [
                    '@i = 1',
                    'while @i <= 3',
                    '  @i += 1',
                    '  @j = 1',
                    '  while @j <= 3',
                    '    puts(@j)',
                    '    @j += 1',
                    '  end',
                    'end',
                ].join('\n'),
                [
                    'i = 1',
                    'i <= 3 の間',
                    '  i += 1',
                    '  j を 1 から 3 まで 1 ずつ増やしながら',
                    '    表示する(j)',
                    '  を繰り返す',
                    'を繰り返す',
                ].join('\n'),
            );
        });

        test('the inner loop uses the same variable', () => {
            const ruby = [
                '@i = 1',
                'while @i <= 3',
                '  @i = 1',
                '  while @i <= 3',
                '    puts(@i)',
                '    @i += 1',
                '  end',
                '  @i += 1',
                'end',
            ].join('\n');
            const dncl = toDncl(ruby);
            expect(dncl).not.toContain(PLACEHOLDER);
            expect(dncl).toBe(
                [
                    'i = 1',
                    'i <= 3 の間',
                    '  i を 1 から 3 まで 1 ずつ増やしながら',
                    '    表示する(i)',
                    '  を繰り返す',
                    '  i += 1',
                    'を繰り返す',
                ].join('\n'),
            );
            expect(toRuby(dncl)).toBe(ruby);
        });
    });
});
