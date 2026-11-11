/**
 * Round trips that used to change the written Ruby (issue #1541):
 * - a method definition ending in `true` / `false` came back as the string `"true"` / `"false"`;
 * - a local variable kept only by name in a field (a `!` method's receiver, koshien `map_from`'s map)
 *   came back as the internal name `@_x_1_`.
 */
import dedent from 'dedent';
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
