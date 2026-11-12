/**
 * A call of a method that returns a value in the condition of `while` / `until` (issue #1606).
 * The blocks call the method before the loop and at the end of the body, so it runs before every
 * check of the condition as in Ruby; the call at the end of the body is not written back to Ruby.
 */
import dedent from 'dedent';
import RubyGenerator from '../../../../src/lib/ruby-generator';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip,
} from '../../helpers/ruby-roundtrip-helper';

const BAR = dedent`
    def self.bar(a)
      return a
    end
`;

describe('Ruby Roundtrip: a call in the condition of a loop (issue #1606)', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    const blocksOf = () => converter._context.blocks;
    const commentOf = (block) => {
        const comment = block && block.comment && converter._context.comments[block.comment];
        return comment ? comment.text : '';
    };
    const chain = (firstId) => {
        const result = [];
        let block = blocksOf()[firstId];
        while (block) {
            result.push(block);
            block = blocksOf()[block.next];
        }
        return result;
    };
    const loopBlock = () => Object.values(blocksOf()).find((b) => b.opcode === 'control_repeat_until');
    const isCallOf = (block, proccode) =>
        !!block && block.opcode === 'procedures_call' && block.mutation.proccode === proccode;
    // The blocks at the end of the body of the loop that compute the condition again.
    const tailOf = (loop) => {
        const body = loop.inputs.SUBSTACK ? chain(loop.inputs.SUBSTACK.block) : [];
        return body.filter((b) => commentOf(b).includes('@ruby:loop_condition_call'));
    };

    const roundTrip = (code) => expectRoundTrip(converter, target, `${BAR}\n\n${code}`);

    describe.each([
        ['while bar(a) < 3', 'a = a + 1'],
        ['while 3 > bar(a)', 'a = a + 1'],
        ['until bar(a) == 0', 'a = a - 1'],
        ['while bar(a) < 3 && @x == 1', 'a = a + 1'],
        ['while bar(a) < 3 || bar(a) == 5', 'a = a + 1'],
        ['while bar(bar(a)) < 3', 'a = a + 1'],
    ])('%s', (condition, body) => {
        const code = dedent`
            a = 0
            ${condition}
              ${body}
            end
        `;

        test('comes back as written', async () => {
            await roundTrip(code);
        });

        test('the call is made again at the end of the body, after the lines of the body', async () => {
            await roundTrip(code);
            const loop = loopBlock();
            expect(loop).toBeTruthy();
            const before = Object.values(blocksOf()).find((b) => b.next === loop.id);
            expect(isCallOf(before, 'bar %s')).toBe(true);

            const body = chain(loop.inputs.SUBSTACK.block);
            const tail = tailOf(loop);
            expect(tail.length).toBeGreaterThan(0);
            // The lines of the body come first, then the calls.
            expect(body.slice(body.length - tail.length)).toEqual(tail);
            expect(body[0].opcode).toBe('data_setvariableto');
            expect(isCallOf(tail[tail.length - 1], 'bar %s')).toBe(true);
        });
    });

    test('the same number of calls is made before the loop and at the end of the body', async () => {
        await roundTrip('a = 0\nwhile bar(a) < 3 || bar(a) == 5\n  a = a + 1\nend');
        const loop = loopBlock();
        const calls = tailOf(loop).filter((b) => b.opcode === 'procedures_call');
        expect(calls).toHaveLength(2);
    });

    test('two calls in the condition keep each value (while bar(1) < bar(2))', async () => {
        await roundTrip('a = 0\nwhile bar(1) < bar(2)\n  a = a + 1\nend');
        const tail = tailOf(loopBlock());
        // The value of the first call is saved before the second call overwrites it.
        expect(tail.map((b) => b.opcode)).toEqual(['procedures_call', 'data_setvariableto', 'procedures_call']);
    });

    test('a call in an if condition with two calls (if bar(1) < bar(2))', async () => {
        await roundTrip('a = 0\nif bar(1) < bar(2)\n  a = 1\nend');
    });

    test('an empty body', async () => {
        await roundTrip('a = 0\nwhile bar(a) < 3\nend');
        expect(tailOf(loopBlock()).length).toBeGreaterThan(0);
    });

    test('wait until bar(a) == 0 calls bar while waiting', async () => {
        await roundTrip('a = 0\nwait until bar(a) == 0');
        const loop = loopBlock();
        expect(loop).toBeTruthy();
        expect(isCallOf(tailOf(loop)[0], 'bar %s')).toBe(true);
        expect(Object.values(blocksOf()).some((b) => b.opcode === 'control_wait_until')).toBe(false);
    });

    test('a block put in the body of wait until on the blocks screen is written (until ... end)', async () => {
        await roundTrip('a = 0\nwait until bar(a) == 0');
        // Put `move(10)` after the calls, as on the blocks screen.
        const blocks = target.blocks._blocks;
        const loop = Object.values(blocks).find((b) => b.opcode === 'control_repeat_until');
        const last = chain(loop.inputs.SUBSTACK.block).pop();
        blocks.move = {
            id: 'move',
            opcode: 'motion_movesteps',
            inputs: { STEPS: { name: 'STEPS', block: 'steps', shadow: 'steps' } },
            fields: {},
            next: null,
            parent: last.id,
            shadow: false,
            topLevel: false,
        };
        blocks.steps = {
            id: 'steps',
            opcode: 'math_number',
            inputs: {},
            fields: { NUM: { name: 'NUM', value: '10' } },
            next: null,
            parent: 'move',
            shadow: true,
            topLevel: false,
        };
        last.next = 'move';
        RubyGenerator.currentTarget = target;
        expect(RubyGenerator.targetToCode(target, {}).trim()).toBe(
            `${BAR}\n\na = 0\nuntil bar(a) == 0\n  move(10)\nend`,
        );
    });

    test('a body that ends with wait', async () => {
        await roundTrip('a = 0\nuntil bar(a) == 3\n  a = a + 1\n  wait\nend');
    });

    test('a body that ends with wait (no call)', async () => {
        await roundTrip('a = 0\nwhile a < 3\n  a = a + 1\n  wait\nend');
    });

    test('a condition without a call has no call at the end of the body', async () => {
        await roundTrip('a = 0\nwhile a < 3\n  a = a + 1\nend');
        expect(tailOf(loopBlock())).toHaveLength(0);
    });

    test('a body that never ends (loop do) gets no call at its end', async () => {
        await roundTrip('a = 0\nwhile bar(a) < 3\n  loop do\n    move(10)\n  end\nend');
        expect(tailOf(loopBlock())).toHaveLength(0);
    });

    test('a loop in a method', async () => {
        await roundTrip(dedent`
            def self.foo(n)
              i = n
              while bar(i) < 3
                i = i + 1
              end
            end
        `);
    });

    test('a loop in a loop', async () => {
        await roundTrip(dedent`
            a = 0
            while bar(a) < 3
              b = 0
              until bar(b) == 2
                b = b + 1
              end
              a = a + 1
            end
        `);
    });
});

describe('Ruby Roundtrip: the program of issue #1606', () => {
    test('comes back as written', async () => {
        const { target, runtime } = makeSpriteTarget();
        setupRubyGenerator();
        const converter = makeConverter(target, runtime, { version: 2 });
        target.sprite = { name: 'Sprite1' };
        runtime.targets = [{ isStage: true, sprite: { name: 'Stage' } }, target];
        const code = dedent`
            class Sprite1
              def bar(a)
                return a
              end

              when_flag_clicked do
                a = 0
                while bar(a) < 3
                  a = a + 1
                end
              end
            end
        `;
        await expectRoundTrip(converter, target, code);
        const blocks = Object.values(converter._context.blocks);
        const loop = blocks.find((b) => b.opcode === 'control_repeat_until');
        let last = converter._context.blocks[loop.inputs.SUBSTACK.block];
        while (last.next) last = converter._context.blocks[last.next];
        expect(last.opcode).toBe('procedures_call');
        expect(last.mutation.proccode).toBe('bar %s');
    });
});
