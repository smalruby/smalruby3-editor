/**
 * Round trips that used to change the written Ruby (issue #1541):
 * - a method definition ending in `true` / `false` came back as the string `"true"` / `"false"`
 *   (and, issue #1548, `nil` / `:a` came back as `""` / `"a"`);
 * - a local variable kept only by name in a field (a `!` method's receiver, koshien `map_from`'s map)
 *   came back as the internal name `@_x_1_`.
 */
import dedent from 'dedent';
import RubyGenerator from '../../../../src/lib/ruby-generator';
import {
    makeSpriteTarget,
    makeStageTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip,
} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby Roundtrip: literal at the end of a method definition', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    test('true', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
                def self.foo
                  true
                end
            `,
        );
    });

    test('false', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
                def self.foo
                  false
                end
            `,
        );
    });

    test('true after a statement, used as a value', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
                def self.foo
                  move(10)
                  true
                end

                say(foo)
            `,
        );
    });

    test('true after an early return false', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
                def self.foo(a)
                  if a
                    return false
                  end
                  true
                end
            `,
        );
    });

    test.each([
        ['the string "true"', '"true"'],
        ['the string "false"', '"false"'],
        ['a string', '"a"'],
        ['an integer', '1'],
        ['a float', '1.5'],
        ['a logical expression', 'true && false'],
    ])('%s stays as it is', async (_name, value) => {
        await expectRoundTrip(converter, target, `def self.foo\n  ${value}\nend`);
    });

    // issue #1548: `nil` / a symbol came back as `""` / `"a"`.
    test.each([
        ['nil', 'nil'],
        ['a symbol', ':a'],
        ['a symbol with a question mark', ':a?'],
        ['a Japanese symbol', ':あ'],
        ['a quoted symbol', ':"a b"'],
        ['a symbol converted to a string', ':a.to_s'],
        ['the empty string', '""'],
    ])('%s stays as it is', async (_name, value) => {
        await expectRoundTrip(converter, target, `def self.foo\n  ${value}\nend`);
    });

    test.each([
        ['nil', 'nil'],
        ['a symbol', ':a'],
    ])('%s after a statement, used as a value', async (_name, value) => {
        await expectRoundTrip(converter, target, `def self.foo\n  move(10)\n  ${value}\nend\n\nsay(foo)`);
    });

    test.each([
        ['nil', 'nil'],
        ['a symbol', ':a'],
    ])('%s in Ruby version 2', async (_name, value) => {
        converter = makeConverter(target, runtime, { version: 2 });
        await expectRoundTrip(converter, target, `def foo\n  ${value}\nend`);
    });

    test.each([
        ['nil', 'nil'],
        ['a symbol', ':a'],
        ['a quoted symbol', ':"a b"'],
    ])('return %s stays as it is', async (_name, value) => {
        await expectRoundTrip(
            converter,
            target,
            `def self.foo(a)\n  if a\n    return ${value}\n  end\n  1\nend\n\nsay(foo(true))`,
        );
    });

    // A comment keeps one line for the marker: a symbol with a line break comes back as a string,
    // without a stray `# b` comment line.
    test.each([
        ['at the end', 'def self.foo\n  :"a\\nb"\nend', 'def self.foo\n  "a\\nb"\nend'],
        ['after return', 'def self.foo\n  return :"a\\nb"\nend', 'def self.foo\n  return "a\\nb"\nend'],
    ])('a symbol with a line break %s comes back as a string', async (_name, code, expected) => {
        await converter.targetCodeToBlocks(target, code);
        await converter.applyTargetBlocks(target);
        RubyGenerator.currentTarget = target;
        expect(RubyGenerator.targetToCode(target, { version: converter.version }).trim()).toBe(expected);
    });

    test.each([
        ['nil', 'nil', '"x"'],
        ['a symbol', ':a', '"x"'],
    ])('%s edited as a text block comes back as the new text', async (_name, value, expected) => {
        await converter.targetCodeToBlocks(target, `def self.foo\n  ${value}\nend`);
        await converter.applyTargetBlocks(target);
        const textBlock = Object.values(target.blocks._blocks).find(b => b.opcode === 'text');
        textBlock.fields.TEXT.value = 'x';
        RubyGenerator.currentTarget = target;
        expect(RubyGenerator.targetToCode(target, { version: converter.version }).trim()).toBe(
            `def self.foo\n  ${expected}\nend`,
        );
    });

    test('true in Ruby version 2', async () => {
        converter = makeConverter(target, runtime, { version: 2 });
        await expectRoundTrip(
            converter,
            target,
            dedent`
                def foo
                  true
                end
            `,
        );
    });
});

describe('Ruby Roundtrip: local variable kept in a field', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    test.each([
        ['reverse!', 'ticket.reverse!'],
        ['delete!', 'ticket.delete!("a")'],
        ['gsub!', 'ticket.gsub!("a", "b")'],
    ])('String#%s on a top-level local variable', async (_name, call) => {
        await expectRoundTrip(converter, target, `ticket = "abc"\n${call}`);
    });

    test('String#reverse! on a local variable in an event', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
                self.when(:flag_clicked) do
                  ticket = "abc"
                  ticket.reverse!
                end
            `,
        );
    });

    test('String#reverse! on a local variable in a method', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
                def self.foo
                  ticket = "abc"
                  ticket.reverse!
                end
            `,
        );
    });

    test('String#reverse! on a local variable in the stage', async () => {
        ({ target, runtime } = makeStageTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
        await expectRoundTrip(converter, target, 'ticket = "abc"\nticket.reverse!');
    });

    test.each([
        ['sort!', 'a.sort!'],
        ['reverse!', 'a.reverse!'],
    ])('Array#%s on a local variable (Ruby version 2)', async (_name, call) => {
        converter = makeConverter(target, runtime, { version: 2 });
        await expectRoundTrip(converter, target, `a = [3, 1]\n${call}`);
    });

    test.each([
        ['$ticket'],
        ['@ticket'],
    ])('String#reverse! on %s keeps its prefix', async (name) => {
        await expectRoundTrip(converter, target, `${name} = "abc"\n${name}.reverse!`);
    });

    test.each([
        ['@_x_1_'],
        ['$_x_1_'],
    ])('String#reverse! on %s (named like a local variable inside) keeps its name', async (name) => {
        await expectRoundTrip(converter, target, `${name} = "abc"\n${name}.reverse!`);
    });

    test('koshien map_from with a local variable', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
                m = koshien.map_all
                $マップ情報 = koshien.map_from("14:0", m)
            `,
        );
    });

    test('koshien map_from with a local variable, assigned to a local variable', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
                m = koshien.map_all
                n = koshien.map_from("14:0", m)
            `,
        );
    });

    test('koshien list arguments with local variables (Ruby version 2)', async () => {
        converter = makeConverter(target, runtime, { version: 2 });
        await expectRoundTrip(
            converter,
            target,
            dedent`
                route = []
                cells = []
                objs = []
                koshien.calc_route(result: route, src: "4:5", dst: "6:7", except_cells: cells)
                koshien.locate_objects(result: objs, sq_size: 3, cent: "1:2", objects: "ABCD")
            `,
        );
    });
});
