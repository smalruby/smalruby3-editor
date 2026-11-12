// === Smalruby: This file is Smalruby-specific (string `+` from the evidence of the whole code, issue #1659) ===
/**
 * `@a + "x"` is the string `+` (`operator_join`) when the code sets `@a` only to strings
 * (`gets`, `answer`, a string literal, `to_s`), even where the converter has not seen the
 * string yet (in a method that reads `@a` first). A name that the code sets to a number stays
 * the number `+` (`operator_add`).
 */
import dedent from 'dedent';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip,
} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby to blocks: string + from the evidence of the code (issue #1659)', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime, { version: '2' });
    });

    const opcodesOf = () => Object.values(converter._context.blocks).map((b) => b.opcode);

    describe('a name set only to strings is joined', () => {
        test.each([
            ['@a = gets', '@a = gets\nsay(@a + "x")'],
            ['answer + "!"', 'ask("name?")\nsay(answer + "!")'],
            ['@a = answer', 'ask("name?")\n@a = answer\nsay(@a + "!")'],
            ['@a = "abc"', '@a = "abc"\n@b = @a + "d"'],
            ['@a = 1.to_s', '@a = 1.to_s\nsay(@a + "x")'],
            ['$a = gets', '$a = gets\nsay($a + "x")'],
            ['a local', 'a = gets\nsay(a + "x")'],
            [
                'read in a method before it is set',
                dedent`
                    def f
                      say(@a + "x")
                    end

                    @a = gets
                    f
                `,
            ],
            ['@a += "x"', '@a = gets\n@a += "x"'],
            ['@a = @a + "x"', '@a = gets\n@a = @a + "x"\nsay(@a)'],
            ['@a + 1.to_s', '@a = gets\nsay(@a + 1.to_s)'],
            ['@a + @b, @b set to a string literal', '@a = gets\n@b = "x"\nsay(@a + @b)'],
            ['a local += "x"', 'a = gets\na += "x"'],
            [
                'a local in a method',
                dedent`
                    def f
                      a = gets
                      say(a + "x")
                    end

                    f
                `,
            ],
        ])('%s', async (_name, code) => {
            await expectRoundTrip(converter, target, code);
            expect(opcodesOf()).toContain('operator_join');
            expect(opcodesOf()).not.toContain('operator_add');
        });
    });

    describe('a name set to a number is added', () => {
        test.each([
            ['@a = 0', '@a = 0\nsay(@a + 1)'],
            ['@a += 1', '@a += 1\nsay(@a + 1)'],
            [
                'read in a method before it is set',
                dedent`
                    def f
                      say(@a + 1)
                    end

                    @a = 0
                    f
                `,
            ],
            ['a string and a number', '@a = gets\n@a = 0\nsay(@a + 1)'],
            // Not known to be a String on the right: the number `+`, as before.
            ['@a = gets then @a + 1', '@a = gets\nsay(@a + 1)'],
            ['@a = gets then @a + @b', '@a = gets\nsay(@a + @b)'],
            // Two numbers asked with gets and added: keep the addition the program runs as.
            ['@a + @b, both set by gets', '@a = gets\n@b = gets\nsay(@a + @b)'],
        ])('%s', async (_name, code) => {
            await expectRoundTrip(converter, target, code);
            expect(opcodesOf()).toContain('operator_add');
            expect(opcodesOf()).not.toContain('operator_join');
        });
    });

    test('@a += @b, both set by gets, stays the number change as before', async () => {
        await expectRoundTrip(converter, target, '@a = gets\n@b = gets\n@a += @b');
        expect(opcodesOf()).toContain('data_changevariableby');
        expect(opcodesOf()).not.toContain('operator_join');
    });
});
