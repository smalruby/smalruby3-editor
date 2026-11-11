/**
 * `false` in a Boolean (hexagonal) input becomes an empty hole (#1491).
 *
 * Scratch has no Boolean literal and the Ruby generator writes an empty Boolean
 * input as `false`, so `if false` <=> "if < > then" round-trips without the
 * `0 < 0` stand-in block. `false` outside a Boolean input (an assignment, a
 * `==` operand, ...) keeps the `0 < 0` block with the `@ruby:literal:false:N` comment.
 */
import dedent from 'dedent';

import {
    makeConverter,
    makeSpriteTarget,
    rubyToBlocksToRuby,
    setupRubyGenerator,
} from '../../helpers/ruby-roundtrip-helper';
import RubyGenerator from '../../../../src/lib/ruby-generator';

const FALSE_COMMENT = /^@ruby:literal:false:/;

const convert = async (code) => {
    const { target, runtime } = makeSpriteTarget();
    const converter = makeConverter(target, runtime, { version: '2' });
    const ok = await converter.targetCodeToBlocks(target, code);
    if (!ok) throw new Error(JSON.stringify(converter.errors));
    return converter;
};

const blocksOf = (converter, opcode) =>
    Object.values(converter._context.blocks).filter((b) => b.opcode === opcode);

const falseComments = (converter) =>
    Object.values(converter._context.comments).filter((c) => FALSE_COMMENT.test(c.text));

describe('RubyToBlocksConverter: false in a Boolean input', () => {
    beforeEach(() => {
        setupRubyGenerator();
    });

    describe('becomes an empty hole', () => {
        test.each([
            ['if', 'if false\n  move(10)\nend', 'control_if', 'CONDITION'],
            ['if modifier', 'move(10) if false', 'control_if', 'CONDITION'],
            ['if/else', 'if false\n  move(10)\nelse\n  move(20)\nend', 'control_if_else', 'CONDITION'],
            ['until', 'until false\n  move(10)\nend', 'control_repeat_until', 'CONDITION'],
            ['wait until', 'wait until false', 'control_wait_until', 'CONDITION'],
            ['unless', 'unless false\n  move(10)\nend', 'operator_not', 'OPERAND'],
            ['while', 'while false\n  move(10)\nend', 'operator_not', 'OPERAND'],
            ['!', 'if !false\n  move(10)\nend', 'operator_not', 'OPERAND'],
            ['not', 'if not false\n  move(10)\nend', 'operator_not', 'OPERAND'],
            ['&& (left)', 'if false && touching?("_edge_")\n  move(10)\nend', 'operator_and', 'OPERAND1'],
            ['|| (right)', 'if touching?("_edge_") || false\n  move(10)\nend', 'operator_or', 'OPERAND2'],
        ])('%s', async (_name, code, opcode, inputName) => {
            const converter = await convert(code);
            const [block] = blocksOf(converter, opcode);
            expect(block).toBeDefined();
            expect(block.inputs[inputName]).toBeUndefined();
            // no `0 < 0` block, no orphan text block, no `@ruby:literal:false:` comment is left behind
            expect(blocksOf(converter, 'operator_lt')).toHaveLength(0);
            expect(falseComments(converter)).toHaveLength(0);
            Object.values(converter._context.blocks).forEach((b) => {
                expect(b.topLevel || b.parent).toBeTruthy();
            });
        });

        test('elsif', async () => {
            const converter = await convert(dedent`
                if touching?("_edge_")
                  move(1)
                elsif false
                  move(2)
                end
            `);
            const [inner] = blocksOf(converter, 'control_if');
            expect(inner.inputs.CONDITION).toBeUndefined();
            expect(blocksOf(converter, 'operator_lt')).toHaveLength(0);
        });

        test('both operands of &&', async () => {
            const converter = await convert('false && false');
            const [block] = blocksOf(converter, 'operator_and');
            expect(block.inputs.OPERAND1).toBeUndefined();
            expect(block.inputs.OPERAND2).toBeUndefined();
            expect(Object.keys(converter._context.blocks)).toEqual([block.id]);
        });
    });

    describe('keeps the 0 < 0 block outside a Boolean input', () => {
        test.each([
            ['bare false', 'false'],
            ['assignment', 'a = false'],
            ['== operand', 'if x == false\n  move(10)\nend'],
        ])('%s', async (_name, code) => {
            const converter = await convert(code);
            // (an assignment visits its value twice; only the connected block counts)
            const connected = blocksOf(converter, 'operator_lt').filter((b) => b.topLevel || b.parent);
            expect(connected).toHaveLength(1);
            expect(converter._context.comments[connected[0].comment].text).toMatch(FALSE_COMMENT);
        });

        test('numbers the remaining false literals from 1', async () => {
            const converter = await convert('if false\n  move(10)\nend\nx == false');
            expect(falseComments(converter).map((c) => c.text)).toEqual(['@ruby:literal:false:1']);
        });
    });

    describe('round trip', () => {
        const codes = [
            'if false\n  move(10)\nend',
            'move(10) if false',
            'if false\n  move(10)\nelse\n  move(20)\nend',
            'if touching?("_edge_")\n  move(1)\nelsif false\n  move(2)\nend',
            'unless false\n  move(10)\nend',
            'until false\n  move(10)\nend',
            'while false\n  move(10)\nend',
            'wait until false',
            'if !false\n  move(10)\nend',
            'if false && touching?("_edge_")\n  move(10)\nend',
            'if touching?("_edge_") || false\n  move(10)\nend',
            'false && false',
            '!false',
            'a = false',
            'if x == false\n  move(10)\nend',
        ];

        test.each(codes)('Ruby -> blocks -> Ruby: %s', async (code) => {
            const { target, runtime } = makeSpriteTarget();
            const converter = makeConverter(target, runtime, { version: '2' });
            expect(await rubyToBlocksToRuby(converter, target, code)).toBe(code);
        });

        test.each(codes)('blocks -> Ruby -> blocks is stable: %s', async (code) => {
            const { target, runtime } = makeSpriteTarget();
            const converter = makeConverter(target, runtime, { version: '2' });
            const ruby1 = await rubyToBlocksToRuby(converter, target, code);
            const shape = (blocks) =>
                Object.values(blocks)
                    .filter((b) => !b.shadow)
                    .map((b) => `${b.opcode}[${Object.keys(b.inputs).sort().join(',')}]`)
                    .sort();
            const before = shape(target.blocks._blocks);

            const { target: target2, runtime: runtime2 } = makeSpriteTarget();
            const converter2 = makeConverter(target2, runtime2, { version: '2' });
            const ruby2 = await rubyToBlocksToRuby(converter2, target2, ruby1);
            expect(ruby2).toBe(ruby1);
            expect(shape(target2.blocks._blocks)).toEqual(before);
        });

        test('an empty hole made in the block editor is written as `if false` and comes back empty', async () => {
            const { target, runtime } = makeSpriteTarget();
            target.blocks.createBlock({
                id: 'hat',
                opcode: 'event_whenflagclicked',
                inputs: {},
                fields: {},
                next: 'if',
                parent: null,
                shadow: false,
                topLevel: true,
                x: 0,
                y: 0,
            });
            target.blocks.createBlock({
                id: 'if',
                opcode: 'control_if',
                inputs: {},
                fields: {},
                next: null,
                parent: 'hat',
                shadow: false,
                topLevel: false,
            });
            RubyGenerator.currentTarget = target;
            const ruby = RubyGenerator.targetToCode(target, { version: '2' }).trim();
            expect(ruby).toBe('when_flag_clicked do\n  if false\n  end\nend');

            const converter = makeConverter(target, runtime, { version: '2' });
            expect(await rubyToBlocksToRuby(converter, target, ruby)).toBe(ruby);
            const ifBlock = Object.values(converter._context.blocks).find((b) => b.opcode === 'control_if');
            expect(ifBlock.inputs.CONDITION).toBeUndefined();
            expect(blocksOf(converter, 'operator_lt')).toHaveLength(0);
        });
    });
});
