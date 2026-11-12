/**
 * "repeat until" whose body is empty or has `wait` (issues #1655 / #1656).
 *
 * - An empty "repeat until" must not come back as "wait until": the generator writes it as
 *   `until x do` / `end` (the form that is not saved), and the converter reads the `do` as a loop.
 *   `until x` / `end` without `do` stays "wait until", as before (issue #1649).
 * - `wait` in the body of `until` / `while` must not be lost: the loop keeps it as a mark, together
 *   with the mark of `with_screen_refresh`. Only `wait until x` (the modifier) is "wait until".
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
 * Describe the scripts of a target as nested opcodes and the comments of the loops.
 * @param {object} target - The target whose blocks to describe.
 * @returns {Array} One entry per top-level block.
 */
const describeScripts = (target) => {
    const blocks = target.blocks._blocks;
    const commentOf = (id) => {
        const comment = Object.values(target.comments).find((c) => c.blockId === id);
        return comment ? comment.text.split(',').sort() : [];
    };
    const describeStack = (id) => {
        const list = [];
        let block = blocks[id];
        while (block) {
            const entry = { opcode: block.opcode };
            const substack = block.inputs && block.inputs.SUBSTACK;
            if (substack) entry.substack = substack.block ? describeStack(substack.block) : [];
            if (block.opcode.startsWith('control_')) entry.comment = commentOf(block.id);
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
 * Put `when flag clicked` + one "repeat until" (with no condition) on the target.
 * @param {object} target - The target to put the script on.
 * @param {?string} comment - The comment of the loop, or null.
 * @param {boolean} withMove - Whether the body has `move(10)`.
 */
const putRepeatUntilScript = (target, comment, withMove = false) => {
    createBlock(target, { id: 'hat', opcode: 'event_whenflagclicked', next: 'loop', topLevel: true, x: 0, y: 0 });
    const inputs = {};
    if (withMove) inputs.SUBSTACK = { name: 'SUBSTACK', block: 'move', shadow: null };
    createBlock(target, { id: 'loop', opcode: 'control_repeat_until', parent: 'hat', inputs });
    if (withMove) {
        createBlock(target, {
            id: 'move',
            opcode: 'motion_movesteps',
            parent: 'loop',
            inputs: { STEPS: { name: 'STEPS', block: 'steps', shadow: 'steps' } },
        });
        createBlock(target, {
            id: 'steps',
            opcode: 'math_number',
            parent: 'move',
            shadow: true,
            fields: { NUM: { name: 'NUM', value: '10' } },
        });
    }
    if (comment) {
        target.createComment('c1', 'loop', comment, 0, 0, 200, 200, true);
    }
};

/**
 * Blocks -> Ruby -> Blocks.
 * @param {object} target - The target with the blocks.
 * @param {object} options - The options of the generator.
 * @returns {Promise<object>} The Ruby code and the described scripts of the new target.
 */
const blocksToRubyToBlocks = async (target, options) => {
    RubyGenerator.currentTarget = target;
    const code = RubyGenerator.targetToCode(target, options).trim();
    const { target: target2, runtime: runtime2 } = makeSpriteTarget();
    const converter2 = makeConverter(target2, runtime2, { version: Number(options.version) });
    const result = await converter2.targetCodeToBlocks(target2, code);
    expect(converter2.errors).toEqual([]);
    expect(result).toBe(true);
    await converter2.applyTargetBlocks(target2);
    return { code, scripts: describeScripts(target2) };
};

describe('Ruby Roundtrip: until / while whose body is empty or has wait (issues #1655 / #1656)', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime, { version: 2 });
    });

    describe('Blocks -> Ruby -> Blocks: an empty "repeat until" stays "repeat until" (issue #1655)', () => {
        test.each([
            [2, false, 'when_flag_clicked do\n  until false do\n  end\nend'],
            [2, true, 'when_flag_clicked do\n  until false\n    with_screen_refresh do\n    end\n  end\nend'],
            [1, false, 'when_flag_clicked do\n  until false do\n  end\nend'],
        ])('v%s (forSave: %s)', async (version, forSave, expectedCode) => {
            putRepeatUntilScript(target, null);
            const { code, scripts } = await blocksToRubyToBlocks(target, { version: String(version), forSave });
            if (version === 1) {
                expect(code).toContain('until false do\n');
            } else {
                expect(code).toBe(expectedCode);
            }
            expect(scripts[0][1].opcode).toBe('control_repeat_until');
            expect(scripts[0][1].substack).toEqual([]);
        });

        test('while (forSave: false)', async () => {
            putRepeatUntilScript(target, '@ruby:syntax:while');
            const { code, scripts } = await blocksToRubyToBlocks(target, { version: '2', forSave: false });
            expect(code).toBe('when_flag_clicked do\n  while false do\n  end\nend');
            expect(scripts[0][1]).toEqual({
                opcode: 'control_repeat_until',
                substack: [],
                comment: ['@ruby:syntax:while'],
            });
        });
    });

    describe('Blocks -> Ruby -> Blocks: `wait` stays (issue #1656)', () => {
        test.each([
            ['@ruby:method:wait', false, false],
            ['@ruby:method:wait', false, true],
            ['@ruby:method:wait', true, false],
            ['@ruby:method:with_screen_refresh,@ruby:method:wait', false, false],
            ['@ruby:method:with_screen_refresh,@ruby:method:wait', true, true],
        ])('%s (with move: %s, forSave: %s)', async (comment, withMove, forSave) => {
            putRepeatUntilScript(target, comment, withMove);
            const { code, scripts } = await blocksToRubyToBlocks(target, { version: '2', forSave });
            expect(code).toContain('wait\n');
            expect(code).not.toContain('wait until');
            const loop = scripts[0][1];
            expect(loop.opcode).toBe('control_repeat_until');
            expect(loop.comment).toContain('@ruby:method:wait');
            expect(loop.substack).toEqual(withMove ? [{ opcode: 'motion_movesteps' }] : []);
        });
    });

    describe('Ruby -> Blocks -> Ruby', () => {
        test.each([
            ['an empty until with do', 'until x > 1 do\n  end'],
            ['an empty while with do', 'while x > 1 do\n  end'],
            ['until with only wait', 'until x > 1\n    wait\n  end'],
            ['while with only wait', 'while x > 1\n    wait\n  end'],
            ['until with move and wait', 'until x > 1\n    move(1)\n    wait\n  end'],
            [
                'until with with_screen_refresh and wait',
                'until x > 1\n    with_screen_refresh do\n      wait\n    end\n  end',
            ],
            [
                'until with with_screen_refresh, move and wait',
                'until x > 1\n    with_screen_refresh do\n      move(1)\n      wait\n    end\n  end',
            ],
            [
                'while with with_screen_refresh, move and wait',
                'while x > 1\n    with_screen_refresh do\n      move(1)\n      wait\n    end\n  end',
            ],
            ['wait until', 'wait until x > 1'],
            ['until with a body', 'until x > 1\n    move(1)\n  end'],
            ['while with a body', 'while x > 1\n    move(1)\n  end'],
        ])('%s', async (_name, loop) => {
            await expectRoundTrip(converter, target, `when_flag_clicked do\n  ${loop}\nend`);
        });

        test('until / while with an empty body and no do stay "wait until"', async () => {
            await expectRoundTrip(
                converter,
                target,
                'when_flag_clicked do\n  until x > 1\n  end\nend',
                'when_flag_clicked do\n  wait until x > 1\nend',
            );
        });

        test('the saved form', async () => {
            const code = dedent`
                when_flag_clicked do
                  until x > 1
                    with_screen_refresh do
                      wait
                    end
                  end
                  until x > 2
                    with_screen_refresh do
                      move(1)
                      wait
                    end
                  end
                  until x > 3
                    with_screen_refresh do
                    end
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
                until x > 1 do
                end
                until x > 1
                  wait
                end
            `,
            );
        });
    });
});
