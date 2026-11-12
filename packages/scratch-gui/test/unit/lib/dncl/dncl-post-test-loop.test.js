/**
 * `begin ... end while cond` / `begin ... end until cond` in the Japanese (DNCL) mode (issue #1626).
 *
 * The body of the loop runs once before the condition is checked. DNCL (the 手順記述標準言語
 * of 大学入試センター) writes this "後判定" loop as
 *   繰り返し、
 *     処理
 *   を、条件 になるまで実行する
 * so `end until cond` is `を cond になるまで実行する` and `end while cond` is
 * `を cond でなくなるまで実行する`, and both come back to the same Ruby.
 */
import { dnclLanguageConfiguration } from '../../../../src/containers/ruby-tab/dncl-mode';
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
import { findDnclBlockErrors } from '../../../../src/lib/dncl/dncl-validator';
import { rubyToDncl } from '../../../../src/lib/dncl/ruby-to-dncl';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    rubyToBlocksToRuby,
} from '../../helpers/ruby-roundtrip-helper';

const rToD = (src) => rubyToDncl(src).dncl;
const dToR = (src) => dnclToRuby(src).ruby;

describe('DNCL: 後判定の繰り返し (begin ... end while / until, issue #1626)', () => {
    describe('Ruby → DNCL', () => {
        test('begin ... end while → 繰り返し ... を 〜 でなくなるまで実行する', () => {
            expect(rToD('@a = 0\nbegin\n  @a = @a + 1\nend while @a < 3')).toBe(
                'a = 0\n繰り返し\n  a = a + 1\nを a < 3 でなくなるまで実行する',
            );
        });

        test('begin ... end until → 繰り返し ... を 〜 になるまで実行する', () => {
            expect(rToD('@a = 0\nbegin\n  @a = @a + 1\nend until @a >= 3')).toBe(
                'a = 0\n繰り返し\n  a = a + 1\nを a >= 3 になるまで実行する',
            );
        });

        test('the words begin / end are not left in the DNCL', () => {
            const dncl = rToD('@a = 0\nbegin\n  @a = @a + 1\n  move(10)\nend while @a < 3');
            expect(dncl).not.toMatch(/\bbegin\b/);
            expect(dncl).not.toMatch(/\bend\b/);
        });

        test('nested in a while loop and an if', () => {
            const ruby = [
                'while @b < 2',
                '  if @b > 0',
                '    begin',
                '      @a = @a + 1',
                '    end until @a >= 3',
                '  end',
                '  @b = @b + 1',
                'end',
            ].join('\n');
            expect(rToD(ruby)).toBe(
                [
                    'b < 2 の間',
                    '  もし b > 0 ならば',
                    '    繰り返し',
                    '      a = a + 1',
                    '    を a >= 3 になるまで実行する',
                    '  を実行する',
                    '  b = b + 1',
                    'を繰り返す',
                ].join('\n'),
            );
        });

        test('a counting loop inside the body still becomes 〜ずつ増やしながら', () => {
            const ruby = [
                'begin',
                '  @i = 1',
                '  while @i <= 3',
                '    @a = @a + @i',
                '    @i += 1',
                '  end',
                'end while @a < 10',
            ].join('\n');
            expect(rToD(ruby)).toBe(
                [
                    '繰り返し',
                    '  i を 1 から 3 まで 1 ずつ増やしながら',
                    '    a = a + i',
                    '  を繰り返す',
                    'を a < 10 でなくなるまで実行する',
                ].join('\n'),
            );
        });

        test('begin ... end without while / until is left as it is', () => {
            expect(rToD('begin\n  @a = 1\nend')).toBe('begin\n  a = 1\nend');
        });
    });

    describe('DNCL → Ruby', () => {
        test('を 〜 でなくなるまで実行する → end while', () => {
            expect(dToR('a = 0\n繰り返し\n  a = a + 1\nを a < 3 でなくなるまで実行する')).toBe(
                '@a = 0\nbegin\n  @a = @a + 1\nend while @a < 3',
            );
        });

        test('を 〜 になるまで実行する → end until', () => {
            expect(dToR('a = 0\n繰り返し\n  a = a + 1\nを a >= 3 になるまで実行する')).toBe(
                '@a = 0\nbegin\n  @a = @a + 1\nend until @a >= 3',
            );
        });

        test('the commas of DNCL (繰り返し、 / を、) are taken', () => {
            expect(dToR('繰り返し、\n  a = a + 1\nを、a >= 3 になるまで実行する')).toBe(
                'begin\n  @a = @a + 1\nend until @a >= 3',
            );
            expect(dToR('繰り返し，\n  a = a + 1\nを，a >= 3 になるまで実行する')).toBe(
                'begin\n  @a = @a + 1\nend until @a >= 3',
            );
        });

        test('a condition is converted as the condition of 〜の間', () => {
            const condition = 'a >= 3 かつ 要素数(B) > 0 または 真';
            const whileRuby = dToR(`${condition} の間\n  a = a + 1\nを繰り返す`);
            const whileCondition = whileRuby.split('\n')[0].replace(/^while /, '');
            expect(dToR(`繰り返し\n  a = a + 1\nを ${condition} になるまで実行する`)).toBe(
                `begin\n  @a = @a + 1\nend until ${whileCondition}`,
            );
            expect(whileCondition).toContain('&&');
        });

        test('the words 繰り返し / 実行する do not become variables', () => {
            const ruby = dToR('繰り返し\n  a = a + 1\nを a >= 3 になるまで実行する');
            expect(ruby).not.toMatch(/@繰り返し|@begin|@を/);
        });
    });

    describe('DNCL → Ruby → DNCL', () => {
        test.each([
            'a = 0\n繰り返し\n  a = a + 1\nを a < 3 でなくなるまで実行する',
            'a = 0\n繰り返し\n  a = a + 1\nを a >= 3 になるまで実行する',
            'a = 0\nb = 0\nb < 2 の間\n  繰り返し\n    a = a + 1\n  を a >= 3 になるまで実行する\n  b = b + 1\nを繰り返す',
        ])('%s', (dncl) => {
            expect(rToD(dToR(dncl))).toBe(dncl);
        });
    });

    describe('block errors', () => {
        test('a closed 繰り返し has no error', () => {
            expect(findDnclBlockErrors('繰り返し\n  a = a + 1\nを a >= 3 になるまで実行する')).toEqual([]);
        });

        test('an unclosed 繰り返し is told in the words of DNCL', () => {
            const errors = findDnclBlockErrors('繰り返し\n  a = a + 1');
            expect(errors).toHaveLength(1);
            expect(errors[0].line).toBe(1);
            expect(errors[0].message).toContain('「繰り返し」');
            expect(errors[0].message).toContain('になるまで実行する');
        });

        test('a closer without 繰り返し is told', () => {
            const errors = findDnclBlockErrors('a = a + 1\nを a >= 3 になるまで実行する');
            expect(errors).toHaveLength(1);
            expect(errors[0].line).toBe(2);
        });
    });

    describe('blocks: DNCL → Ruby → blocks → Ruby → DNCL', () => {
        let target, runtime, converter;

        beforeEach(() => {
            ({ target, runtime } = makeSpriteTarget());
            setupRubyGenerator();
            converter = makeConverter(target, runtime);
        });

        test.each([
            'a = 0\n繰り返し\n  a = a + 1\nを a < 3 でなくなるまで実行する',
            'a = 0\n繰り返し\n  a = a + 1\nを a >= 3 になるまで実行する',
        ])('%s', async (dncl) => {
            const ruby = dToR(dncl);
            const regenerated = await rubyToBlocksToRuby(converter, target, ruby);
            expect(regenerated).toBe(ruby);
            expect(rToD(regenerated)).toBe(dncl);
        });

        test('the blocks put the body once before a 〜まで繰り返す loop', async () => {
            await rubyToBlocksToRuby(
                converter,
                target,
                dToR('a = 0\n繰り返し\n  a = a + 1\nを a >= 3 になるまで実行する'),
            );
            const blocks = Object.values(converter._context.blocks);
            expect(blocks.some((b) => b.opcode === 'control_repeat_until')).toBe(true);
            expect(blocks.filter((b) => b.opcode === 'data_setvariableto')).toHaveLength(3);
        });
    });

    describe('editor indentation', () => {
        const { increaseIndentPattern, decreaseIndentPattern } = dnclLanguageConfiguration.indentationRules;

        test.each(['繰り返し', '  繰り返し、'])('indents after %s', (line) => {
            expect(increaseIndentPattern.test(line)).toBe(true);
        });

        test.each(['を a >= 3 になるまで実行する', '  を、a < 3 でなくなるまで実行する'])('dedents %s', (line) => {
            expect(decreaseIndentPattern.test(line)).toBe(true);
        });

        test('does not dedent a line that only says 繰り返し', () => {
            expect(decreaseIndentPattern.test('繰り返し')).toBe(false);
        });
    });
});
