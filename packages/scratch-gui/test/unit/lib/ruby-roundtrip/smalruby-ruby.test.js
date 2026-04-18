/**
 * Ruby round-trip unit test for smalrubyRuby extension methods.
 */
import dedent from 'dedent';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip,
} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby Roundtrip: smalrubyRuby extension', () => {
    let target, runtime, converter;
    const opts = { version: '2' };

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime, { version: '2' });
    });

    test('String#reverse with say', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            when_flag_clicked do
              say("Jimmy".reverse, 2)
            end
        `,
            null,
            opts,
        );
    });

    test('String#gsub with say', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            when_flag_clicked do
              say("hello".gsub("l", "r"), 2)
            end
        `,
            null,
            opts,
        );
    });

    test('String#delete with say', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            when_flag_clicked do
              say("hello".delete("l"), 2)
            end
        `,
            null,
            opts,
        );
    });

    test('String#upcase with say', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            when_flag_clicked do
              say("hello".upcase, 2)
            end
        `,
            null,
            opts,
        );
    });

    test('Array#max with say', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            when_flag_clicked do
              ticket = [35, 12, 47]
              say(ticket.max, 2)
            end
        `,
            null,
            opts,
        );
    });

    test('Array#sort with say', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            when_flag_clicked do
              ticket = [35, 12, 47]
              say(ticket.sort, 2)
            end
        `,
            null,
            opts,
        );
    });

    test('String#* with say', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            when_flag_clicked do
              say("Jimmy" * 5, 2)
            end
        `,
            null,
            opts,
        );
    });

    test('Hash#keys with say', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            when_flag_clicked do
              books = {}
              books["Ruby"] = "good"
              say(books.keys, 2)
            end
        `,
            null,
            opts,
        );
    });

    test('bare string literal', async () => {
        await expectRoundTrip(converter, target, '"Jimmy"', null, opts);
    });

    test('bare integer literal', async () => {
        await expectRoundTrip(converter, target, '42', null, opts);
    });

    test('bare literal followed by say', async () => {
        // Bare literal becomes independent top-level block, generated after say
        await expectRoundTrip(
            converter,
            target,
            dedent`
            "hello"
            say("hello")
        `,
            dedent`
            say("hello")

            "hello"
        `,
            opts,
        );
    });

    test('bang method reverse!', async () => {
        // Bang methods use internal variable names (@_s_1_) in generator output
        await expectRoundTrip(
            converter,
            target,
            dedent`
            when_flag_clicked do
              s = "hello"
              s.reverse!
              say(s, 2)
            end
        `,
            dedent`
            when_flag_clicked do
              s = "hello"
              @_s_1_.reverse!
              say(s, 2)
            end
        `,
            opts,
        );
    });

    test('bang method sort!', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            when_flag_clicked do
              t = [3, 1, 2]
              t.sort!
            end
        `,
            dedent`
            when_flag_clicked do
              t = [3, 1, 2]
              @_t_1_.sort!
            end
        `,
            opts,
        );
    });

    test('bare literal inside when_flag_clicked', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            when_flag_clicked do
              "hello"
              say("hello", 2)
            end
        `,
            null,
            opts,
        );
    });

    test('bare literal before hat block', async () => {
        // Hat blocks are sorted to top by generator
        await expectRoundTrip(
            converter,
            target,
            dedent`
            "hi"

            when_flag_clicked do
              say("a", 2)
            end
        `,
            dedent`
            when_flag_clicked do
              say("a", 2)
            end

            "hi"
        `,
            opts,
        );
    });

    test('bare literal before def', async () => {
        // Def blocks are sorted to top by generator
        await expectRoundTrip(
            converter,
            target,
            dedent`
            "hi"

            def greet
              say("hello", 2)
            end
        `,
            dedent`
            def greet
              say("hello", 2)
            end

            "hi"
        `,
            opts,
        );
    });

    test('bare literal before value block', async () => {
        // Value blocks are sorted independently
        await expectRoundTrip(
            converter,
            target,
            dedent`
            "hi"
            2 + 3
        `,
            dedent`
            2 + 3

            "hi"
        `,
            opts,
        );
    });

    // TODO: 2 ** 8 (non-10 base) is not yet supported as a block
    // Only 10 ** n and Math::E ** n are supported via operator_mathop

    test('power operator 10 ** 3', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            when_flag_clicked do
              say(10 ** 3, 2)
            end
        `,
            null,
            opts,
        );
    });

    // TODO: bare array literal roundtrip needs further work
    // test('bare array literal', async () => {
    //     await expectRoundTrip(converter, target, '[12, 47, 35]', null, opts);
    // });
});
