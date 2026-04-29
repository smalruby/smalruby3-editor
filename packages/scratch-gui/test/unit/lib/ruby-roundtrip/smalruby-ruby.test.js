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

    test('consecutive standalone method calls in event handler', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            when_flag_clicked do
              "a".reverse
              "b".upcase
            end
        `,
            dedent`
            when_flag_clicked do
              "a".reverse
              "b".upcase
            end
        `,
            opts,
        );
    });

    test('standalone method call followed by say', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            when_flag_clicked do
              "a".reverse
              say("b".upcase, 2)
            end
        `,
            null,
            opts,
        );
    });

    test('method return value as if condition', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            when_flag_clicked do
              if "hello".reverse
                say("truthy", 2)
              end
            end
        `,
            null,
            opts,
        );
    });

    test('method return value as unless condition', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            when_flag_clicked do
              unless "hello".reverse
                say("falsy", 2)
              end
            end
        `,
            null,
            opts,
        );
    });

    test('Array#each with block', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            when_flag_clicked do
              ticket = [35, 12, 47]
              ticket.each do
                say("hello", 1)
              end
            end
        `,
            null,
            opts,
        );
    });

    test('Array#each with block parameter', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            when_flag_clicked do
              ticket = [35, 12, 47]
              ticket.each do |item|
                say(item, 1)
              end
            end
        `,
            null,
            opts,
        );
    });

    test('Array#each with single-char items round-trips', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            when_flag_clicked do
              ticket = [1, 2, 3]
              ticket.each do |item|
                say(item, 1)
              end
            end
        `,
            null,
            opts,
        );
    });

    test('Array#each receiver list propagates LIST_ID/LIST_NAME on arrayMethodWithBlock', async () => {
        const code = dedent`
            when_flag_clicked do
              ticket = [1, 2, 3]
              ticket.each do |item|
                say(item, 1)
              end
            end
        `;
        const result = await converter.targetCodeToBlocks(target, code);
        expect(result).toBe(true);
        const blocks = Object.values(converter._context.blocks);
        const eachBlock = blocks.find(
            (b) => b.opcode === 'smalrubyRuby_arrayMethodWithBlock',
        );
        expect(eachBlock).toBeDefined();
        expect(eachBlock.fields.LIST_ID).toBeDefined();
        expect(eachBlock.fields.LIST_NAME).toBeDefined();
        expect(eachBlock.fields.LIST_NAME.value).toContain('ticket');
    });

    test('.times do |i| with block parameter', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            when_flag_clicked do
              total = 0
              5.times do |i|
                total += i
              end
            end
        `,
            null,
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

    test('bare array literal', async () => {
        await expectRoundTrip(converter, target, '[12, 47, 35]', null, opts);
    });

    test('array variable assignment and method', async () => {
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

    test('clone roundtrip', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            when_flag_clicked do
              clone
            end
        `,
            null,
            opts,
        );
    });

    test('self.clone converts to clone', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            when_flag_clicked do
              self.clone
            end
        `,
            dedent`
            when_flag_clicked do
              clone
            end
        `,
            opts,
        );
    });

    test('Hash.new(0) produces conversion error', async () => {
        const code = dedent`
            when_flag_clicked do
              votes = Hash.new(0)
            end
        `;
        const result = await converter.targetCodeToBlocks(target, code);
        expect(result).toBeFalsy();
        expect(converter.errors.length).toBeGreaterThan(0);
        expect(converter.errors[0].text).toContain('デフォルト値');
    });

    test('Array.new(5, 0) expands to array literal', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            when_flag_clicked do
              arr = Array.new(5, 0)
            end
        `,
            dedent`
            when_flag_clicked do
              arr = [0, 0, 0, 0, 0]
            end
        `,
            opts,
        );
    });
});
