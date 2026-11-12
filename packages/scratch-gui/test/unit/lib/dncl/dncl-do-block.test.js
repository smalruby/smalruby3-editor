/**
 * Ruby → DNCL with a `xxx do ... end` block inside a DNCL block (issue #1665).
 *
 * `with_screen_refresh do`, `loop do`, `when_flag_clicked do`, `each do |x|` and the like have no
 * DNCL form, so they are shown as they are. Their `end` is `を実行する`, and it must not take the
 * closer of the block around it: `の間 … with_screen_refresh do … end … end` once became
 * `を繰り返す` for the `do` and `を実行する` for the `の間`. The Japanese mode still refuses such
 * code when it is switched to (the dry-run tells it on its line), but the DNCL shown must keep
 * its blocks closed by the right words.
 */
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
import {
    findDnclBlockErrors,
    POST_TEST_LOOP_ERROR_ID,
    UNSUPPORTED_COMMAND_ERROR_ID,
} from '../../../../src/lib/dncl/dncl-validator';
import { rubyToDncl } from '../../../../src/lib/dncl/ruby-to-dncl';

const convert = (code) => rubyToDncl(code).dncl;
const lines = (...ls) => ls.join('\n');

describe('Ruby → DNCL: the end of a do block (issue #1665)', () => {
    test('with_screen_refresh do inside の間', () => {
        const ruby = lines('while @a < 1', '  with_screen_refresh do', '    move(2)', '  end', 'end');
        expect(convert(ruby)).toBe(
            lines('a < 1 の間', '  with_screen_refresh do', '    move(2)', '  を実行する', 'を繰り返す'),
        );
    });

    test('3.times do inside もし', () => {
        const ruby = lines('if @a < 1', '  3.times do', '    @b = @b + 1', '  end', 'end');
        expect(convert(ruby)).toBe(
            lines(
                'もし a < 1 ならば',
                '  _ を 1 から 3 まで 1 ずつ増やしながら',
                '    b = b + 1',
                '  を繰り返す',
                'を実行する',
            ),
        );
    });

    test('nested do blocks inside 関数 and の間', () => {
        const ruby = lines(
            'def f(x)',
            '  while @a < 1',
            '    loop do',
            '      [1, 2].each do |y|',
            '        if @a',
            '          move(y)',
            '        end',
            '      end',
            '    end',
            '  end',
            'end',
        );
        expect(convert(ruby)).toBe(
            lines(
                '関数 f(x)',
                '  a < 1 の間',
                '    loop do',
                '      [1, 2].each do |y|',
                '        もし a ならば',
                '          move(y)',
                '        を実行する',
                '      を実行する',
                '    を実行する',
                '  を繰り返す',
                'と定義する',
            ),
        );
    });

    test('until x do (an empty loop) inside の間 (issue #1667)', () => {
        const ruby = lines('while @a < 1', '  until @x > 1 do', '  end', '  @a = @a + 1', 'end');
        expect(convert(ruby)).toBe(
            lines('a < 1 の間', '  x > 1 でない の間', '  を繰り返す', '  a = a + 1', 'を繰り返す'),
        );
    });

    test.each([
        ['when_flag_clicked do'],
        ['when_key_pressed("space") do'],
        ['self.when(:clicked) do'],
        ['@list.each do |x|'],
        ['[1, 2].each do |x, y|'],
    ])('%s inside the stack is closed by を実行する', (opener) => {
        const ruby = lines('while @a < 1', `  ${opener}`, '    move(2)', '  end', 'end');
        const dncl = convert(ruby).split('\n');
        expect(dncl[3]).toBe('  を実行する');
        expect(dncl[4]).toBe('を繰り返す');
    });

    test('a do at the top level is still closed by を実行する', () => {
        expect(convert(lines('when_flag_clicked do', '  move(2)', 'end'))).toBe(
            lines('when_flag_clicked do', '  move(2)', 'を実行する'),
        );
    });

    test('a do inside a string does not open a block', () => {
        const ruby = lines('while @a < 1', '  puts("do")', '  say("a do", 1)', 'end');
        expect(convert(ruby).split('\n')[3]).toBe('を繰り返す');
    });

    test('a do in a comment at the end of the line does not open a block', () => {
        const ruby = lines('while @a < 1', '  move(1) # what to do', '  puts("#") # do', 'end');
        expect(convert(ruby).split('\n')[3]).toBe('を繰り返す');
    });

    test('a comment after the do does not hide the block', () => {
        const ruby = lines('while @a < 1', '  loop do # forever', '    move(1)', '  end', 'end');
        expect(convert(ruby).split('\n').slice(3)).toEqual(['  を実行する', 'を繰り返す']);
    });

    test('a do block inside the post-test loop does not take its end', () => {
        const ruby = lines('begin', '  with_screen_refresh do', '    move(2)', '  end', 'end while @a < 1');
        const { dncl, errors } = rubyToDncl(ruby);
        expect(dncl.split('\n')[3]).toBe('  を実行する');
        expect(dncl.split('\n')[4]).toBe('end while a < 1');
        expect(errors.filter((e) => e.id === POST_TEST_LOOP_ERROR_ID).map((e) => e.line)).toEqual([1, 5]);
    });

    test('the DNCL of a do block inside の間 has no block error and stops on the do line (issue #1679)', () => {
        const ruby = lines('while @a < 1', '  with_screen_refresh do', '    @b = 1', '  end', 'end');
        const dncl = convert(ruby);
        expect(findDnclBlockErrors(dncl)).toEqual([]);
        const back = dnclToRuby(dncl);
        // Not `@with_screen_refresh do`: the Japanese mode has no such command.
        expect(back.ruby).toBeNull();
        expect(back.errors.map(({ line, id, name }) => ({ line, id, name }))).toEqual([
            { line: 2, id: UNSUPPORTED_COMMAND_ERROR_ID, name: 'with_screen_refresh' },
        ]);
    });
});

describe('findDnclBlockErrors: a do block is closed by を実行する (issue #1665)', () => {
    test('a do block inside の間 is balanced', () => {
        expect(
            findDnclBlockErrors(lines('a < 1 の間', '  loop do', '    a = a + 1', '  を実行する', 'を繰り返す')),
        ).toEqual([]);
    });

    test('a do in a comment is not a block', () => {
        expect(findDnclBlockErrors(lines('a < 1 の間', '  表示する a # do', 'を繰り返す'))).toEqual([]);
    });

    test('a do block left open is told', () => {
        const errors = findDnclBlockErrors(lines('a < 1 の間', '  loop do', '    a = a + 1', 'を繰り返す'));
        expect(errors.length).toBeGreaterThan(0);
    });
});
