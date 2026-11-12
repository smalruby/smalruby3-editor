// Issue #1662: `until a > 10 ... end` (the form the "repeat until" block
// writes) must survive a DNCL round trip. `でない` negates the whole
// condition before it (論理演算は比較演算より弱い), not only the last term.
import dedent from 'dedent';
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
import { rubyToDncl } from '../../../../src/lib/dncl/ruby-to-dncl';
import {
    makeConverter,
    makeSpriteTarget,
    rubyToBlocksToRuby,
    setupRubyGenerator,
} from '../../helpers/ruby-roundtrip-helper';

const toRuby = (dncl) => dnclToRuby(dncl).ruby;
const toDncl = (ruby) => rubyToDncl(ruby).dncl;

describe('Ruby → DNCL: until / !', () => {
    test('until @a > 10', () => {
        expect(toDncl('until @a > 10\n  @a += 1\nend')).toBe('a > 10 でない の間\n  a += 1\nを繰り返す');
    });

    test('until @a > 10 && @b puts the whole condition in parentheses', () => {
        expect(toDncl('until @a > 10 && @b\nend')).toBe('(a > 10 かつ b) でない の間\nを繰り返す');
    });

    test('until @x', () => {
        expect(toDncl('until @x\nend')).toBe('x でない の間\nを繰り返す');
    });

    test('while !(@a > 10)', () => {
        expect(toDncl('while !(@a > 10)\nend')).toBe('(a > 10) でない の間\nを繰り返す');
    });

    test('!f(@x) keeps the call together', () => {
        expect(toDncl('@a = !f(@x)')).toBe('a = f(x) でない');
    });

    test('!= is not a negation', () => {
        expect(toDncl('if @a != 1\nend')).toBe('もし a != 1 ならば\nを実行する');
    });

    test('wait until @a > 10 becomes an empty loop', () => {
        expect(toDncl('wait until @a > 10')).toBe('a > 10 でない の間\nを繰り返す');
    });
});

describe('DNCL → Ruby: でない negates the condition before it', () => {
    test('a > 10 でない の間 → until @a > 10', () => {
        expect(toRuby('a > 10 でない の間\n  a = a + 1\nを繰り返す')).toBe('until @a > 10\n  @a = @a + 1\nend');
    });

    test('(a > 10 かつ b) でない の間 → until @a > 10 && @b', () => {
        expect(toRuby('(a > 10 かつ b) でない の間\nを繰り返す')).toBe('until @a > 10 && @b\nend');
    });

    test('x でない の間 → until @x', () => {
        expect(toRuby('x でない の間\nを繰り返す')).toBe('until @x\nend');
    });

    test('x でない (assignment) stays !@x', () => {
        expect(toRuby('a = x でない')).toBe('@a = !@x');
    });

    test('a == b でない negates the comparison', () => {
        expect(toRuby('a = b == c でない')).toBe('@a = !(@b == @c)');
    });

    test('でない binds tighter than かつ / または', () => {
        expect(toRuby('もし x でない かつ y ならば\nを実行する')).toBe('if !@x && @y\nend');
        expect(toRuby('もし a > 1 でない または b < 2 ならば\nを実行する')).toBe('if !(@a > 1) || @b < 2\nend');
        expect(toRuby('もし a > 1 かつ b < 2 でない ならば\nを実行する')).toBe('if @a > 1 && !(@b < 2)\nend');
    });

    test('a negation inside parentheses or a call stays inside', () => {
        expect(toRuby('もし (a > 1) でない ならば\nを実行する')).toBe('if !(@a > 1)\nend');
        expect(toRuby('表示する(a でない)')).toBe('puts(!@a)');
    });

    test('a group in parentheses is negated as a whole', () => {
        expect(toRuby('もし (x または y) でない ならば\nを実行する')).toBe('if !(@x || @y)\nend');
    });

    test('真 / 偽 でない', () => {
        expect(toRuby('a = 真 でない')).toBe('@a = !true');
        expect(toRuby('a = 偽 でない')).toBe('@a = !false');
    });

    test('a string on the left of the comparison', () => {
        expect(toRuby('a = 「x」 == b でない')).toBe('@a = !("x" == @b)');
    });

    test('a while condition that is not one negation stays while', () => {
        expect(toRuby('a でない かつ b の間\nを繰り返す')).toBe('while !@a && @b\nend');
    });
});

describe('DNCL round trip: until', () => {
    const cases = [
        'until @a > 10\n  @a += 1\nend',
        'until @a > 10 && @b\nend',
        'until @x\nend',
        'until @a > 10\n  until @b\n    @b = true\n  end\nend',
    ];
    test.each(cases)('Ruby → DNCL → Ruby: %s', (ruby) => {
        expect(toRuby(toDncl(ruby))).toBe(ruby);
    });

    test('while !(@a > 10) becomes until @a > 10', () => {
        expect(toRuby(toDncl('while !(@a > 10)\nend'))).toBe('until @a > 10\nend');
    });

    // `!` that negates only the right-hand side of a comparison must not grow
    // into the whole comparison on the way back (`でない` negates everything
    // before it up to かつ / または).
    describe.each([
        ['@c = @a == !@b', 'c = a == (b でない)', '@c = @a == (!@b)'],
        ['@c = @a > 1 && @b == !@d', 'c = a > 1 かつ b == (d でない)', '@c = @a > 1 && @b == (!@d)'],
        ['if @a == !@b\nend', 'もし a == (b でない) ならば\nを実行する', 'if @a == (!@b)\nend'],
        ['until @a == !@b\nend', 'a == (b でない) でない の間\nを繰り返す', 'until @a == (!@b)\nend'],
    ])('a ! on the right of a comparison: %s', (ruby, dncl, back) => {
        test('Ruby → DNCL puts the negation in parentheses', () => {
            expect(toDncl(ruby)).toBe(dncl);
        });
        test('DNCL → Ruby keeps the meaning', () => {
            expect(toRuby(dncl)).toBe(back);
        });
    });

    test.each(['@b = !@x', '@b = !@x && @y', '@b = @x || !@y', '@c = !@a == @b'])(
        'a ! that starts its term needs no parentheses: %s',
        (ruby) => {
            expect(toDncl(ruby)).not.toContain('(');
            expect(toRuby(toDncl(ruby))).toBe(ruby);
        },
    );

    test('wait until @a > 10 keeps the same meaning', () => {
        expect(toRuby(toDncl('wait until @a > 10'))).toBe('until @a > 10\nend');
    });
});

describe('DNCL → Ruby → blocks → Ruby → DNCL: until', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    test('a > 10 でない の間 stays a "repeat until" block', async () => {
        const dncl = dedent`
            a = 0
            a > 10 でない の間
              a = a + 1
            を繰り返す
        `;
        const ruby = toRuby(dncl);
        const ruby2 = await rubyToBlocksToRuby(converter, target, ruby);
        const opcodes = Object.values(converter._context.blocks).map((b) => b.opcode);
        expect(opcodes).toContain('control_repeat_until');
        expect(opcodes).not.toContain('operator_not');
        expect(ruby2).toContain('until @a > 10');
        expect(toDncl(ruby2)).toBe(dncl);
    });

    test('(a > 10 かつ b) でない の間 round-trips', async () => {
        const dncl = dedent`
            a = 0
            b = 偽
            (a > 10 かつ b) でない の間
              a = a + 1
            を繰り返す
        `;
        const ruby2 = await rubyToBlocksToRuby(converter, target, toRuby(dncl));
        expect(ruby2).toContain('until @a > 10 && @b');
        expect(toDncl(ruby2)).toBe(dncl);
    });
});
