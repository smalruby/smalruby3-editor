/**
 * Loops whose body is empty (issue #1649).
 *
 * Scratch lets you make an empty "repeat N" / "forever" C block, and the generator turns it into
 * `N.times do` / `end` or `loop do` / `end` (with `.with_screen_refresh` in the saved form). Those
 * must come back to the same empty C block, not "the wrong instruction".
 */
import dedent from 'dedent';
import RubyGenerator from '../../../../src/lib/ruby-generator';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip,
    rubyToBlocksToRuby,
} from '../../helpers/ruby-roundtrip-helper';

/**
 * Describe the scripts of a target as nested opcodes, following `next` and the C block bodies.
 * @param {object} target - The target whose blocks to describe.
 * @returns {Array} One entry per top-level block.
 */
const describeScripts = (target) => {
    const blocks = target.blocks._blocks;
    const describeStack = (id) => {
        const list = [];
        let block = blocks[id];
        while (block) {
            const entry = { opcode: block.opcode };
            const substack = block.inputs && block.inputs.SUBSTACK;
            if (substack) entry.substack = substack.block ? describeStack(substack.block) : [];
            list.push(entry);
            block = blocks[block.next];
        }
        return list;
    };
    return target.blocks._scripts.map((id) => describeStack(id));
};

const createBlock = (target, block) => {
    target.blocks.createBlock({
        inputs: {},
        fields: {},
        next: null,
        parent: null,
        shadow: false,
        topLevel: false,
        ...block,
    });
};

/**
 * Put `when flag clicked` + one empty loop block (and its number shadow, for repeat) on the target.
 * @param {object} target - The target to put the script on.
 * @param {string} opcode - `control_repeat` or `control_forever`.
 */
const putEmptyLoopScript = (target, opcode) => {
    createBlock(target, {
        id: 'hat',
        opcode: 'event_whenflagclicked',
        next: 'loop',
        topLevel: true,
        x: 0,
        y: 0,
    });
    const inputs = {};
    if (opcode === 'control_repeat') {
        inputs.TIMES = { name: 'TIMES', block: 'times', shadow: 'times' };
    }
    createBlock(target, { id: 'loop', opcode, parent: 'hat', inputs });
    if (opcode === 'control_repeat') {
        createBlock(target, {
            id: 'times',
            opcode: 'math_whole_number',
            parent: 'loop',
            shadow: true,
            fields: { NUM: { name: 'NUM', value: '10' } },
        });
    }
};

describe('Ruby Roundtrip: loops whose body is empty (issue #1649)', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime, { version: 2 });
    });

    describe('Ruby -> Blocks -> Ruby', () => {
        test.each([
            ['N.times', '10.times do\n  end'],
            ['variable.times', 'x.times do\n  end'],
            ['loop', 'loop do\n  end'],
            ['loop.with_screen_refresh', 'loop.with_screen_refresh do\n  end'],
            ['N.times.with_screen_refresh', '10.times.with_screen_refresh do\n  end'],
            ['N.times with a block parameter', '3.times do |i|\n  end'],
        ])('%s', async (_name, loop) => {
            await expectRoundTrip(converter, target, `when_flag_clicked do\n  ${loop}\nend`);
        });

        test('each with a block parameter', async () => {
            await expectRoundTrip(
                converter,
                target,
                dedent`
                a = [1, 2]
                a.each do |x|
                end
            `,
            );
        });

        test('nested empty loops', async () => {
            await expectRoundTrip(
                converter,
                target,
                dedent`
                when_flag_clicked do
                  10.times do
                    loop do
                    end
                  end
                end
            `,
            );
        });

        test('an empty loop followed by a statement keeps the statement after the loop', async () => {
            await expectRoundTrip(
                converter,
                target,
                dedent`
                def f
                  10.times do
                  end
                  move(10)
                end
            `,
            );
        });

        test('a body of only `wait` still keeps the `wait`', async () => {
            await expectRoundTrip(
                converter,
                target,
                dedent`
                when_flag_clicked do
                  10.times.with_screen_refresh do
                    wait
                  end
                end
            `,
            );
        });

        test('in the saved form', async () => {
            const code = dedent`
                when_flag_clicked do
                  loop.with_screen_refresh do
                  end
                  10.times.with_screen_refresh do
                  end
                end
            `;
            expect(await rubyToBlocksToRuby(converter, target, code, { forSave: true })).toBe(code);
        });

        test('Ruby v1', async () => {
            converter = makeConverter(target, runtime, { version: 1 });
            await expectRoundTrip(
                converter,
                target,
                dedent`
                10.times do
                end
                loop do
                end
            `,
            );
        });

        test('until / while with an empty body stay "wait until"', async () => {
            await expectRoundTrip(
                converter,
                target,
                dedent`
                when_flag_clicked do
                  until x > 1
                  end
                end
            `,
                dedent`
                when_flag_clicked do
                  wait until x > 1
                end
            `,
            );
        });
    });

    describe('until / while whose only statement is an empty with_screen_refresh', () => {
        test.each([['until x > 1'], ['while x < 1']])('%s', async (loop) => {
            await expectRoundTrip(
                converter,
                target,
                `when_flag_clicked do\n  ${loop}\n    with_screen_refresh do\n    end\n  end\nend`,
            );
        });

        test('an empty "repeat until" in the saved form comes back as an empty "repeat until"', async () => {
            createBlock(target, {
                id: 'hat',
                opcode: 'event_whenflagclicked',
                next: 'loop',
                topLevel: true,
                x: 0,
                y: 0,
            });
            createBlock(target, { id: 'loop', opcode: 'control_repeat_until', parent: 'hat' });
            RubyGenerator.currentTarget = target;
            const code = RubyGenerator.targetToCode(target, { version: 2, forSave: true }).trim();
            expect(code).toBe('when_flag_clicked do\n  until false\n    with_screen_refresh do\n    end\n  end\nend');

            const { target: target2, runtime: runtime2 } = makeSpriteTarget();
            const converter2 = makeConverter(target2, runtime2, { version: 2 });
            expect(await converter2.targetCodeToBlocks(target2, code)).toBe(true);
            await converter2.applyTargetBlocks(target2);
            expect(describeScripts(target2)).toEqual([
                [{ opcode: 'event_whenflagclicked' }, { opcode: 'control_repeat_until', substack: [] }],
            ]);
        });
    });

    describe('Blocks -> Ruby -> Blocks', () => {
        test.each([
            ['control_repeat', false, '10.times do'],
            ['control_repeat', true, '10.times.with_screen_refresh do'],
            ['control_forever', false, 'loop do'],
            ['control_forever', true, 'loop.with_screen_refresh do'],
        ])('%s (forSave: %s)', async (opcode, forSave, firstLine) => {
            putEmptyLoopScript(target, opcode);
            RubyGenerator.currentTarget = target;
            const code = RubyGenerator.targetToCode(target, { version: 2, forSave }).trim();
            expect(code).toBe(`when_flag_clicked do\n  ${firstLine}\n  end\nend`);

            const { target: target2, runtime: runtime2 } = makeSpriteTarget();
            const converter2 = makeConverter(target2, runtime2, { version: 2 });
            const result = await converter2.targetCodeToBlocks(target2, code);
            expect(converter2.errors).toEqual([]);
            expect(result).toBe(true);
            await converter2.applyTargetBlocks(target2);

            expect(describeScripts(target2)).toEqual([
                [{ opcode: 'event_whenflagclicked' }, { opcode, substack: [] }],
            ]);
        });
    });
});
