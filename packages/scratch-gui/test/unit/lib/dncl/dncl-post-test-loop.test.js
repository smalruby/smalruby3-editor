/**
 * The post-test loop (`begin ... end while / until`) in the Japanese (DNCL) mode (issue #1626).
 *
 * The Japanese mode follows 共通テスト用プログラム表記, which has only the pre-test loops
 * (`〜の間繰り返す` and `〜ずつ増やしながら繰り返す`). The post-test loop
 * (`繰り返し、… を、〜になるまで実行する`) is only in the old DNCL of 情報関係基礎, so the
 * Japanese mode does not write it: `begin ... end while / until` is told as an error on its line,
 * and the DNCL never turns into broken Ruby such as `@begin`.
 */
import { dnclToRuby, rubyForLeavingDncl } from '../../../../src/lib/dncl/dncl-to-ruby';
import { POST_TEST_LOOP_ERROR_ID } from '../../../../src/lib/dncl/dncl-validator';
import { rubyToDncl } from '../../../../src/lib/dncl/ruby-to-dncl';

const dToR = (src) => dnclToRuby(src).ruby;

describe('DNCL: the post-test loop is not supported (issue #1626)', () => {
    describe('Ruby → DNCL', () => {
        test('begin ... end while is told as an error on the begin and end lines', () => {
            const { errors } = rubyToDncl('@a = 0\nbegin\n  @a = @a + 1\nend while @a < 3');
            expect(errors.map((e) => e.line)).toEqual([2, 4]);
            errors.forEach((e) => {
                expect(e.id).toBe(POST_TEST_LOOP_ERROR_ID);
                expect(e.column).toBe(1);
                expect(e.message).toContain('後判定の繰り返し');
            });
        });

        test('begin ... end until is told as an error', () => {
            const { errors } = rubyToDncl('begin\n  @a = @a + 1\nend until @a >= 3');
            expect(errors.map((e) => e.line)).toEqual([1, 3]);
        });

        test('the error line is the Ruby line even when lines before it are merged', () => {
            const ruby = ['@x = ask("")', '@x = answer', 'begin', '  @a = @a + 1', 'end until @a >= 3'].join('\n');
            const { errors } = rubyToDncl(ruby);
            expect(errors.map((e) => e.line)).toEqual([3, 5]);
        });

        test('nested in a while loop, the closers around it stay DNCL', () => {
            const ruby = [
                'while @b < 2',
                '  begin',
                '    @a = @a + 1',
                '  end until @a >= 3',
                '  @b = @b + 1',
                'end',
            ].join('\n');
            const { dncl, errors } = rubyToDncl(ruby);
            expect(errors.map((e) => e.line)).toEqual([2, 4]);
            expect(dncl.split('\n')[0]).toBe('b < 2 の間');
            expect(dncl.split('\n')[5]).toBe('を繰り返す');
        });

        test('the DNCL of it is not a post-test loop of the old DNCL', () => {
            const { dncl } = rubyToDncl('begin\n  @a = @a + 1\nend while @a < 3');
            expect(dncl).not.toMatch(/繰り返し|まで実行する/);
        });

        test('the pre-test loops have no error and do not change', () => {
            const ruby = '@a = 0\nwhile @a < 3\n  @a = @a + 1\nend';
            const { dncl, errors } = rubyToDncl(ruby);
            expect(errors).toEqual([]);
            expect(dncl).toBe('a = 0\na < 3 の間\n  a = a + 1\nを繰り返す');
            expect(dToR(dncl)).toBe(ruby);
        });
    });

    describe('DNCL → Ruby', () => {
        test('the DNCL shown for begin ... end while does not become @begin', () => {
            const { dncl } = rubyToDncl('@a = 0\nbegin\n  @a = @a + 1\nend while @a < 3');
            const result = dnclToRuby(dncl);
            expect(result.ruby).toBeNull();
            expect(result.errors.map((e) => e.line)).toEqual([2, 4]);
            result.errors.forEach((e) => expect(e.id).toBe(POST_TEST_LOOP_ERROR_ID));
        });

        test.each([
            ['begin', 'begin\n  a = a + 1\nend while a < 3', [1, 3]],
            ['end until', 'a = 0\nbegin\n  a = a + 1\nend until a >= 3', [2, 4]],
            ['the old DNCL', '繰り返し、\n  a = a + 1\nを、a >= 3 になるまで実行する', [1, 3]],
            ['the old DNCL without commas', '繰り返し\n  a = a + 1\nを a < 3 でなくなるまで実行する', [1, 3]],
            ['the old DNCL on one line', '繰り返し，a = a + 1 を，a >= 3 になるまで実行する', [1]],
        ])('%s is told as an error on its lines', (name, dncl, lines) => {
            const result = dnclToRuby(dncl);
            expect(result.ruby).toBeNull();
            expect(result.errors.map((e) => e.line)).toEqual(lines);
            result.errors.forEach((e) => expect(e.id).toBe(POST_TEST_LOOP_ERROR_ID));
        });

        test.each([
            ['a variable', '繰り返し回数 = 3\n表示する(繰り返し回数)'],
            ['a string', '表示する("繰り返し")\n表示する("begin")'],
            ['a comment', '# 繰り返し\na = 1 # begin'],
            [
                'the closers of the pre-test loops and if',
                'a = 0\nもし a < 1 ならば\n  a = 1\nを実行する\na < 3 の間\n  a = a + 1\nを繰り返す',
            ],
            ['the DNCLv2 pre-test loop', 'a = 0\na < 3 の間繰り返す:\n  a = a + 1'],
        ])('%s with 繰り返し or begin is not an error', (name, dncl) => {
            expect(dnclToRuby(dncl).errors).toEqual([]);
        });

        test('a variable named begin_count is not an error', () => {
            expect(dnclToRuby('begin_count = 1').errors).toEqual([]);
        });

        test('the pre-test loop does not change', () => {
            expect(dToR('a = 0\na < 3 の間\n  a = a + 1\nを繰り返す')).toBe(
                '@a = 0\nwhile @a < 3\n  @a = @a + 1\nend',
            );
        });
    });

    describe('leaving the Japanese mode', () => {
        test('the last Ruby is kept when the DNCL has a post-test loop', () => {
            const ruby = '@a = 0\nbegin\n  @a = @a + 1\nend while @a < 3';
            expect(rubyForLeavingDncl(rubyToDncl(ruby).dncl, ruby)).toBe(ruby);
        });

        test('an empty Ruby is used when there is no last Ruby', () => {
            expect(rubyForLeavingDncl('begin\nend while a < 3', null)).toBe('');
        });

        test('the DNCL that can become Ruby is converted', () => {
            expect(rubyForLeavingDncl('a = 1', 'old')).toBe('@a = 1');
        });
    });
});
