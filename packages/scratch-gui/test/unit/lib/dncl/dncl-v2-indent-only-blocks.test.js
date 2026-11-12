// DNCLv2 blocks written with indentation only (Issue #1718)
//
// A block whose body is only indented (no `｜` / `⎿`, no closer line) must
// become Ruby indented by its block depth (2 spaces per level), whatever
// the width of the DNCL indent, and it must be closed on numbered lines
// too, where the indent comes after the line number.
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
import { dnclV2Preprocess } from '../../../../src/lib/dncl/dncl-v2-preprocessor';
import { loadPrism } from '../../../../src/lib/prism-parser';
import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';

const ruby = (lines) => dnclToRuby(lines.join('\n')).ruby;

// The converter as the Ruby tab uses it (without a VM).
const toBlocks = async (code) => {
    const converter = new RubyToBlocksConverter(null, { version: '2' });
    const ok = await converter.targetCodeToBlocks(null, code);
    return { ok, errors: converter.errors };
};

describe('DNCLv2 indentation-only blocks: Ruby indent (Issue #1718)', () => {
    test('a 4-space body becomes a 2-space Ruby body', () => {
        expect(ruby(['もし x > 0 ならば:', '    y = 1'])).toBe('if @x > 0\n  @y = 1\nend');
    });

    test('a counting loop indents its body and the added step alike', () => {
        expect(ruby(['i を 1 から 3 まで 1 ずつ増やしながら繰り返す:', '    表示する(i)'])).toBe(
            '@i = 1\nwhile @i <= 3\n  puts(@i)\n  @i += 1\nend',
        );
    });

    test.each([
        ['2 spaces', '  '],
        ['3 spaces', '   '],
        ['4 spaces', '    '],
        ['a full-width space', '　'],
        ['a tab', '\t'],
    ])('a body indented by %s becomes 2 spaces per level', (_name, step) => {
        expect(
            ruby([
                'i を 1 から 2 まで 1 ずつ増やしながら繰り返す:',
                `${step}もし i > 1 ならば:`,
                `${step}${step}表示する(i)`,
                `${step}そうでなければ:`,
                `${step}${step}表示する(0)`,
                '表示する("end")',
            ]),
        ).toBe(
            [
                '@i = 1',
                'while @i <= 2',
                '  if @i > 1',
                '    puts(@i)',
                '  else',
                '    puts(0)',
                '  end',
                '  @i += 1',
                'end',
                'puts("end")',
            ].join('\n'),
        );
    });

    test('blank lines and trailing comments keep their place', () => {
        expect(ruby(['もし x > 0 ならば: # 正のとき', '    y = 1 # 代入', '', '    z = 2', 'w = 3'])).toBe(
            ['if @x > 0 # 正のとき', '  @y = 1 # 代入', '', '  @z = 2', 'end', '@w = 3'].join('\n'),
        );
    });

    test('a function with a Japanese name indents and closes its body', () => {
        expect(ruby(['合計(a) を定義する:', '    もし a > 0 ならば:', '        表示する(a)', '表示する(1)'])).toBe(
            'def 合計(a)\n  if a > 0\n    puts(a)\n  end\nend\nputs(1)',
        );
    });

    test('the pre-processor re-indents by block depth', () => {
        expect(dnclV2Preprocess(['もし a ならば:', '        a = 1', 'b = 2'].join('\n')).split('\n')).toEqual([
            'もし a ならば',
            '  a = 1',
            'を実行する',
            'b = 2',
        ]);
    });
});

describe('DNCLv2 indentation-only blocks on numbered lines (Issue #1718)', () => {
    test('the indent after the line number opens and closes the block', () => {
        expect(ruby(['(1) もし x > 0 ならば:', '(2)     y = 1', '(3) z = 2'])).toBe(
            'if @x > 0\n  @y = 1\nend\n@z = 2',
        );
    });

    test('a block still open at the end of a numbered program is closed', () => {
        expect(ruby(['(1) もし x > 0 ならば:', '(2)     y = 1'])).toBe('if @x > 0\n  @y = 1\nend');
    });

    test('numbered nesting, else and a counting loop', () => {
        expect(
            ruby([
                '(01) i を 1 から 2 まで 1 ずつ増やしながら繰り返す:',
                '(02)   もし i > 1 ならば:',
                '(03)     表示する(i)',
                '(04)   そうでなければ:',
                '(05)     表示する(0)',
                '(06) 表示する("end")',
            ]),
        ).toBe(
            [
                '@i = 1',
                'while @i <= 2',
                '  if @i > 1',
                '    puts(@i)',
                '  else',
                '    puts(0)',
                '  end',
                '  @i += 1',
                'end',
                'puts("end")',
            ].join('\n'),
        );
    });

    test('line numbers of different widths (`(00-1)` / `(01)`) do not look like an indent', () => {
        expect(ruby(['(00-1) a = 1', '(01) もし a > 0 ならば:', '(02)     a = 2', '(03) b = 3'])).toBe(
            '@a = 1\nif @a > 0\n  @a = 2\nend\n@b = 3',
        );
    });

    test('line numbers aligned by padding (`(9)  x` / `(10) x`) do not look like an indent', () => {
        expect(
            ruby([
                '(7)  hidari <= migi の間繰り返す:',
                '(8)      もし aida == 3 ならば:',
                '(9)          owari = 1',
                '(10)     そうでなくもし aida < 3 ならば:',
                '(11)         hidari = aida + 1',
                '(12)     そうでなければ:',
                '(13)         migi = aida - 1',
                '(14) 表示する(owari)',
            ]),
        ).toBe(
            [
                'while @hidari <= @migi',
                '  if @aida == 3',
                '    @owari = 1',
                '  elsif @aida < 3',
                '    @hidari = @aida + 1',
                '  else',
                '    @migi = @aida - 1',
                '  end',
                'end',
                'puts(@owari)',
            ].join('\n'),
        );
        expect(ruby(['(9)  もし x > 0 ならば:', '(10)  y = 1', '(11) z = 2'])).toBe(
            'if @x > 0\n  @y = 1\nend\n@z = 2',
        );
    });

    test('`｜` / `⎿` markers on numbered lines still work', () => {
        expect(ruby(['(1) もし x > 0 ならば:', '(2)  ⎿ y = 1', '(3) z = 2'])).toBe(
            'if @x > 0\n  @y = 1\nend\n@z = 2',
        );
    });
});

describe('DNCLv2 indentation-only blocks: error columns (Issue #1718)', () => {
    // The Ruby indent is made from the block depth, but errors are shown on
    // the DNCL the user wrote, so their columns must not move with it.
    const errorAt = (lines) => {
        const [error] = dnclToRuby(lines.join('\n')).errors;
        return lines[error.line - 1].substring(error.column - 1);
    };

    test('an error on a 4-space indented line points at the code', () => {
        expect(errorAt(['もし x > 0 ならば:', '    move(2)'])).toBe('move(2)');
        expect(errorAt(['もし x > 0 ならば', '    move(2)', 'を実行する'])).toBe('move(2)');
    });

    test('an error on a numbered line points at the code', () => {
        expect(errorAt(['(1) もし x > 0 ならば:', '(2)     a = @b'])).toBe('@b');
        expect(errorAt(['(1) もし x > 0 ならば:', '(2) ⎿ move(1)'])).toBe('move(1)');
    });
});

describe('DNCLv2 indentation-only blocks: the Ruby turns into blocks (Issue #1718)', () => {
    let prism;
    beforeAll(async () => {
        prism = await loadPrism();
    });

    test.each([
        ['4 spaces', ['もし x > 0 ならば:', '    y = 1']],
        ['counting loop', ['i を 1 から 3 まで 1 ずつ増やしながら繰り返す:', '    表示する(i)']],
        ['numbered', ['(1) もし x > 0 ならば:', '(2)     y = 1', '(3) z = 2']],
        [
            'numbered, nested',
            [
                '(1) i を 1 から 2 まで 1 ずつ増やしながら繰り返す:',
                '(2)     もし i > 1 ならば:',
                '(3)         表示する(i)',
                '(4)     そうでなければ:',
                '(5)         表示する(0)',
            ],
        ],
    ])('%s', async (_name, lines) => {
        const result = dnclToRuby(lines.join('\n'));
        expect(result.errors).toEqual([]);
        expect(prism.parse(result.ruby).errors).toEqual([]);
        const converted = await toBlocks(result.ruby);
        expect(converted.errors).toEqual([]);
        expect(converted.ok).toBe(true);
    });
});
