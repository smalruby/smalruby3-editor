/**
 * The definition of a custom block (My Block) in Ruby:
 * - "run without screen refresh" (the `warp` of the prototype) is `without_screen_refresh def ...`
 *   (issue #2114).
 * - a name that cannot be a Ruby method name (it starts with a digit, or is a reserved word) gets
 *   a `_` in front, and the `_` is taken off again on the way back (issue #2116).
 */
import dedent from 'dedent';
import RubyGenerator from '../../../../src/lib/ruby-generator';
import {
    expectRoundTrip,
    makeConverter,
    makeSpriteTarget,
    rubyToBlocksToRuby,
    setupRubyGenerator,
} from '../../helpers/ruby-roundtrip-helper';

const blocksOf = (target, opcode) => Object.values(target.blocks._blocks).filter((b) => b.opcode === opcode);

const generate = (target, version) => {
    RubyGenerator.currentTarget = target;
    return RubyGenerator.targetToCode(target, { version }).trim();
};

describe('Ruby Roundtrip: run without screen refresh (issue #2114)', () => {
    let target, runtime, converter;

    const convert = async (code, version = '2') => {
        ({ target, runtime } = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime, { version });
        const ok = await converter.targetCodeToBlocks(target, code);
        if (!ok) throw new Error(JSON.stringify(converter.errors));
        await converter.applyTargetBlocks(target);
    };

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime, { version: '2' });
    });

    test('without_screen_refresh def makes a definition that runs without screen refresh', async () => {
        await convert(dedent`
            without_screen_refresh def 学習する
              @見る長さ = 1
            end
        `);
        const [prototype] = blocksOf(target, 'procedures_prototype');
        expect(prototype.mutation.warp).toBe('true');
    });

    test('a plain def runs with screen refresh', async () => {
        await convert(dedent`
            def 学習する
              @見る長さ = 1
            end
        `);
        const [prototype] = blocksOf(target, 'procedures_prototype');
        expect(prototype.mutation.warp).toBe('false');
    });

    test('a definition that runs without screen refresh is written with without_screen_refresh', async () => {
        await convert(dedent`
            def 学習する(n)
              @見る長さ = n
            end

            学習する(2)
        `);
        blocksOf(target, 'procedures_prototype')[0].mutation.warp = 'true';
        expect(generate(target, '2')).toEqual(dedent`
            without_screen_refresh def 学習する(n)
              @見る長さ = n
            end

            学習する(2)
        `);
    });

    test('warp as a boolean (a loaded project) is written too', async () => {
        await convert('def foo\n  move(10)\nend');
        blocksOf(target, 'procedures_prototype')[0].mutation.warp = true;
        expect(generate(target, '2')).toEqual('without_screen_refresh def foo\n  move(10)\nend');
    });

    test.each([
        [
            'arguments and a return value',
            dedent`
            without_screen_refresh def add(a, b)
              a + b
            end

            when_flag_clicked do
              say(add(1, 2))
            end
        `,
        ],
        [
            'a call of a method in the body',
            dedent`
            def foo(n)
              n * 2
            end

            without_screen_refresh def bar(n)
              say(foo(1) + n)
            end

            bar(3)
        `,
        ],
        [
            'two definitions, one of them without screen refresh',
            dedent`
            def foo
              move(10)
            end

            without_screen_refresh def bar
              10.times do
                move(1)
              end
            end
        `,
        ],
    ])('round trip: %s', async (_name, code) => {
        expect(await rubyToBlocksToRuby(converter, target, code)).toEqual(code);
    });

    test('round trip at Ruby v1 (def self.)', async () => {
        ({ target, runtime } = makeSpriteTarget());
        converter = makeConverter(target, runtime, { version: '1' });
        const code = dedent`
            without_screen_refresh def self.foo
              move(10)
            end
        `;
        expect(await rubyToBlocksToRuby(converter, target, code)).toEqual(code);
    });

    test('round trip in a class', async () => {
        const inClass = async (code) => {
            ({ target, runtime } = makeSpriteTarget());
            target.sprite = { name: 'Sprite1', costumes: [], sounds: [] };
            target.runtime.targets = [target];
            converter = makeConverter(target, runtime, { version: '2' });
            return rubyToBlocksToRuby(converter, target, code);
        };
        const plain = await inClass('class Sprite1\n  def foo\n    move(10)\n  end\nend');
        const warp = await inClass('class Sprite1\n  without_screen_refresh def foo\n    move(10)\n  end\nend');
        expect(warp).toEqual(plain.replace('def foo', 'without_screen_refresh def foo'));
        expect(warp).toContain('  without_screen_refresh def foo\n');
    });

    test('round trip in a module', async () => {
        ({ target, runtime } = makeSpriteTarget());
        target.sprite = { name: 'Sprite1', costumes: [], sounds: [] };
        runtime.targets = [runtime.getTargetForStage(), target];
        converter = makeConverter(target, runtime, { version: '2' });
        const code = dedent`
            module Walk
              without_screen_refresh def walk
                move(10)
              end
            end

            class Sprite1
              include Walk

              when_flag_clicked do
                walk
              end
            end
        `;
        expect(await rubyToBlocksToRuby(converter, target, code)).toEqual(code);
        expect(blocksOf(target, 'procedures_prototype')[0].mutation.warp).toBe('true');
    });

    test('a method of the user named without_screen_refresh is called as it is', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            def without_screen_refresh(n)
              move(n)
            end

            without_screen_refresh(10)
        `,
        );
    });
});

describe('Ruby Roundtrip: a name of a custom block that cannot be a Ruby method name (issue #2116)', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime, { version: '2' });
    });

    const convert = async (code) => {
        const ok = await converter.targetCodeToBlocks(target, code);
        if (!ok) throw new Error(JSON.stringify(converter.errors));
        await converter.applyTargetBlocks(target);
    };

    const renameProcedure = (from, to) => {
        [...blocksOf(target, 'procedures_prototype'), ...blocksOf(target, 'procedures_call')].forEach((b) => {
            b.mutation.proccode = b.mutation.proccode.replace(from, to);
        });
    };

    test('a name that starts with a digit gets `_` in Ruby', async () => {
        await convert(dedent`
            def foo(n)
              say(n)
            end

            foo(1)
        `);
        renameProcedure('foo', '1 文字えらぶ');
        expect(generate(target, '2')).toEqual(dedent`
            def _1_文字えらぶ(n)
              say(n)
            end

            _1_文字えらぶ(1)
        `);
    });

    test('the `_` is taken off on the way back', async () => {
        await convert(dedent`
            def _1_文字えらぶ(n)
              say(n)
            end

            _1_文字えらぶ(1)
        `);
        const [prototype] = blocksOf(target, 'procedures_prototype');
        expect(prototype.mutation.proccode).toBe('1_文字えらぶ %s');
        const [call] = blocksOf(target, 'procedures_call');
        expect(call.mutation.proccode).toBe('1_文字えらぶ %s');
    });

    test.each([
        ['end', '_end'],
        ['if', '_if'],
        ['_1 x', '__1_x'],
        ['_end', '__end'],
        ['1', '__1'],
        ['_1', '___1'],
        ['10', '_10'],
    ])('the block name %s is written %s and comes back', async (blockName, rubyName) => {
        await convert('def foo\n  move(10)\nend\n\nfoo');
        renameProcedure(/^foo/, blockName);
        const ruby = generate(target, '2');
        expect(ruby).toEqual(`def ${rubyName}\n  move(10)\nend\n\n${rubyName}`);

        ({ target, runtime } = makeSpriteTarget());
        converter = makeConverter(target, runtime, { version: '2' });
        await convert(ruby);
        expect(blocksOf(target, 'procedures_prototype')[0].mutation.proccode).toBe(blockName.replace(' ', '_'));
        expect(generate(target, '2')).toEqual(ruby);
    });

    test.each([
        [
            'a call whose value is used',
            dedent`
            def _1_文字えらぶ(n)
              n + 1
            end

            when_flag_clicked do
              say(_1_文字えらぶ(3))
            end
        `,
        ],
        [
            'an explicit return',
            dedent`
            def _1_文字えらぶ(n)
              return n + 1
            end

            when_flag_clicked do
              say(_1_文字えらぶ(3) + _1_文字えらぶ(4))
            end
        `,
        ],
        [
            'without screen refresh',
            dedent`
            without_screen_refresh def _2_回(n)
              move(n)
            end

            _2_回(1)
        `,
        ],
        [
            'an ordinary name with an underscore in front',
            dedent`
            def _foo
              move(10)
            end

            _foo
        `,
        ],
    ])('round trip: %s', async (_name, code) => {
        expect(await rubyToBlocksToRuby(converter, target, code)).toEqual(code);
    });
});
