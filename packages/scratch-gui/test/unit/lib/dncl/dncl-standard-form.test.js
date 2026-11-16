// The Japanese mode writes the standard form (Issue #1754)
//
// Ruby → Japanese writes 標準の形 (`docs/dncl/design.md` 3 章, the 「書く」
// column): blocks by indent (4 spaces a level) and a `:` at the end of the
// opener, no closer lines, `and` / `or` / `not`, `％`, `値 を返す` and
// `関数 名前(引数):`. The Japanese reads back to the same Ruby, and the
// DNCL 風の形 is still read. The programs are made up for the tests (no
// problem of 大学入試センター).
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
import { FORMS, rubyToDncl } from '../../../../src/lib/dncl/ruby-to-dncl';
import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';

const lines = (...ls) => ls.join('\n');
const toJapanese = (ruby) => rubyToDncl(ruby).dncl;
const toRuby = (japanese) => dnclToRuby(japanese).ruby;

// [name, Ruby, the standard form]. Each row goes both ways.
const ROWS = [
    ['an assignment', '@a = 3', 'a = 3'],
    ['an if', lines('if @a > 0', '  @b = 1', 'end'), lines('もし a > 0 ならば:', '    b = 1')],
    [
        'an if, elsif and else',
        lines('if @a > 0', '  @b = 1', 'elsif @a < 0', '  @b = 2', 'else', '  @b = 3', 'end'),
        lines(
            'もし a > 0 ならば:',
            '    b = 1',
            'そうでなくもし a < 0 ならば:',
            '    b = 2',
            'そうでなければ:',
            '    b = 3',
        ),
    ],
    [
        'a counting loop',
        lines('@i = 1', 'while @i <= 10', '  puts(@i)', '  @i += 1', 'end'),
        lines('i を 1 から 10 まで 1 ずつ増やしながら繰り返す:', '    表示する(i)'),
    ],
    [
        'a counting loop down',
        lines('@i = 10', 'while @i >= 1', '  puts(@i)', '  @i += -2', 'end'),
        lines('i を 10 から 1 まで 2 ずつ減らしながら繰り返す:', '    表示する(i)'),
    ],
    [
        'a loop while a condition holds',
        lines('while @a < 10', '  @a = @a + 1', 'end'),
        lines('a < 10 の間繰り返す:', '    a = a + 1'),
    ],
    [
        'a loop until a condition holds',
        lines('until @a > 10', '  @a = @a + 1', 'end'),
        lines('not a > 10 の間繰り返す:', '    a = a + 1'),
    ],
    [
        'blocks in blocks',
        lines(
            '@i = 1',
            'while @i <= 3',
            '  if @i % 2 == 0',
            '    puts(@i)',
            '  else',
            '    puts(0)',
            '  end',
            '  @i += 1',
            'end',
            'puts("end")',
        ),
        lines(
            'i を 1 から 3 まで 1 ずつ増やしながら繰り返す:',
            '    もし i ％ 2 == 0 ならば:',
            '        表示する(i)',
            '    そうでなければ:',
            '        表示する(0)',
            '表示する("end")',
        ),
    ],
    ['and / or / not', '@c = @a && @b || !@d', 'c = a and b or not d'],
    ['not of a comparison', '@c = !(@a > 1)', 'c = not (a > 1)'],
    ['the remainder', '@c = @a % 3', 'c = a ％ 3'],
    ['display of some values', 'puts(@i.to_s + "x")', '表示する(i, "x")'],
    ['input as it is', lines('ask("")', '@a = answer'), 'a = 【外部からの入力】'],
    ['input as an integer', lines('ask("")', '@n = answer.to_i'), 'n = 【整数を入力】'],
    [
        'a function and its return value',
        lines('def twice(x)', '  return x * 2', 'end', '@a = twice(3)'),
        lines('関数 twice(x):', '    x * 2 を返す', 'a = twice(3)'),
    ],
    ['a return value with not', lines('def no(x)', '  return !x', 'end'), lines('関数 no(x):', '    not x を返す')],
    [
        'a block with no body keeps its closer',
        lines('if @a > 0', 'end', '@b = 1'),
        lines('もし a > 0 ならば:', 'を実行する', 'b = 1'),
    ],
    [
        'a comment after a block keeps the closer',
        lines('if @a > 0', '  @b = 1', 'end', '# c', '@d = 1'),
        lines('もし a > 0 ならば:', '    b = 1', 'を実行する', '# c', 'd = 1'),
    ],
    [
        'a blank line after a block stays after it',
        lines('if @a > 0', '  @b = 1', 'end', '', '@d = 1'),
        lines('もし a > 0 ならば:', '    b = 1', '', 'd = 1'),
    ],
    [
        'a program that ends with a block and a new line',
        lines('if @a > 0', '  puts("big")', 'end', ''),
        lines('もし a > 0 ならば:', '    表示する("big")', ''),
    ],
    [
        'a comment at the end of a line',
        lines('if @a > 0 # 正のとき', '  @b = 1', 'end'),
        lines('もし a > 0 ならば: # 正のとき', '    b = 1'),
    ],
];

describe('the standard form: Ruby → Japanese (Issue #1754)', () => {
    test.each(ROWS)('%s', (_name, ruby, japanese) => {
        expect(toJapanese(ruby)).toBe(japanese);
    });
});

describe('the standard form: Japanese → Ruby (Issue #1754)', () => {
    test.each(ROWS)('%s', (_name, ruby, japanese) => {
        expect(toRuby(japanese)).toBe(ruby);
    });
});

describe('the standard form: Japanese → Ruby → Japanese gives the same text (Issue #1754)', () => {
    test.each(ROWS)('%s', (_name, _ruby, japanese) => {
        expect(toJapanese(toRuby(japanese))).toBe(japanese);
    });
});

describe('the standard form: the Ruby read back turns into blocks (Issue #1754)', () => {
    // What the Ruby tab checks before it shows the Japanese (without a VM).
    test.each(ROWS)('%s', async (_name, _ruby, japanese) => {
        const converter = new RubyToBlocksConverter(null, { version: '2' });
        const ok = await converter.targetCodeToBlocks(null, toRuby(japanese));
        expect(converter.errors).toEqual([]);
        expect(ok).toBe(true);
    });
});

describe('the standard form: what only goes one way (Issue #1754)', () => {
    test.each([
        [
            'a Ruby with no indent is indented by its blocks',
            lines('if @a', '@b = 1', 'end'),
            'もし a ならば:\n    b = 1',
        ],
        [
            'a Ruby with a wide indent is indented 4 spaces a level',
            lines('if @a', '        @b = 1', 'end'),
            'もし a ならば:\n    b = 1',
        ],
        ['a not in a term is put in parentheses', '@c = !@a == @b', 'c = (not a) == b'],
        ['a not after an operator is put in parentheses', '@c = @a == !@b', 'c = a == (not b)'],
        [
            'an until joined by and is put in parentheses',
            lines('until @a > 10 && @b', '  @a = @a + 1', 'end'),
            lines('not (a > 10 and b) の間繰り返す:', '    a = a + 1'),
        ],
    ])('%s', (_name, ruby, japanese) => {
        expect(toJapanese(ruby)).toBe(japanese);
        // It still means the same program.
        expect(toRuby(toJapanese(toRuby(japanese)))).toBe(toRuby(japanese));
    });
});

describe('the DNCL 風の形 is still read (Issue #1754)', () => {
    test.each([
        ['an if', lines('もし a > 0 ならば', '  b = 1', 'を実行する'), lines('if @a > 0', '  @b = 1', 'end')],
        [
            'a counting loop',
            lines('i を 1 から 3 まで 1 ずつ増やしながら', '  表示する(i)', 'を繰り返す'),
            lines('@i = 1', 'while @i <= 3', '  puts(@i)', '  @i += 1', 'end'),
        ],
        ['かつ / または / でない', 'c = a かつ b または d でない', '@c = @a && @b || !@d'],
        ['the remainder', 'c = a % 3', '@c = @a % 3'],
        [
            'a function',
            lines('関数 twice(x)', '  返す x * 2', 'と定義する'),
            lines('def twice(x)', '  return x * 2', 'end'),
        ],
    ])('%s', (_name, japanese, ruby) => {
        expect(toRuby(japanese)).toBe(ruby);
    });

    test('the DNCL 風の形 is still written when asked for', () => {
        expect(rubyToDncl(lines('if @a && !@b', '  return @a % 3', 'end'), { form: FORMS.DNCL }).dncl).toBe(
            lines('もし a かつ b でない ならば', '  返す a % 3', 'を実行する'),
        );
    });
});
