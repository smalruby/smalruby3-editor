/**
 * A variable alone as a condition (e.g. `while @x`, `if a < 3 && @x`) (issue #1611).
 *
 * The blocks have no "is the variable true" block, so the converter makes `not (x = false)` and marks
 * it. The mark is on that block, not on the `if` / loop: a mark on the loop made the generator write
 * the whole condition as the variable (`while a < 3 && @x` came back as `while @x`).
 */
import Cast from '@smalruby/scratch-vm/src/util/cast';
import dedent from 'dedent';
import RubyGenerator from '../../../../src/lib/ruby-generator';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip,
} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby Roundtrip: a variable alone as a condition (issue #1611)', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    describe.each([
        'while a < 3 && @x\n  move(10)\nend',
        'while @x && a < 3\n  move(10)\nend',
        'if a < 3 && @x\n  move(10)\nend',
        'if a < 3 && @x\n  move(10)\nelse\n  move(5)\nend',
        'until @x || a > 3\n  move(10)\nend',
        'move(10) if a < 3 && @x',
        'move(10) unless @x && a > 1',
        'unless @x && a > 1\n  move(10)\nend',
        'unless @x || a > 1\n  move(10)\nelse\n  move(5)\nend',
        'while @x\n  move(10)\nend',
        'until @x\n  move(10)\nend',
        'while !@x\n  move(10)\nend',
        'while !@x && @y\n  move(10)\nend',
        'if @x && @y\n  move(10)\nend',
        'if @x || @y\n  move(10)\nend',
        'if !(@x && @y)\n  move(10)\nend',
        'while @x && (a < 3 && @y)\n  move(10)\nend',
        'while @x || a < 3 && @y\n  move(10)\nend',
        'if a > 1\n  move(10)\nelsif @y\n  move(5)\nend',
        'if @x\n  move(10)\nelsif @y && a > 1\n  move(5)\nelse\n  move(1)\nend',
        'begin\n  move(10)\nend while a < 3 && @x',
        'if $flag && a < 3\n  move(10)\nend',
        'wait until @x && a > 3',
        'p(@x && @y)',
        'p(!@x)',
    ])('%s', (code) => {
        test('round-trips as written', async () => {
            await expectRoundTrip(converter, target, `a = 1\n${code}`);
        });
    });

    test('`!(@x == "false")` written by hand stays as it is', async () => {
        await expectRoundTrip(converter, target, 'if !(@x == "false")\n  move(10)\nend');
    });

    test('a variable in an operator inside a method body round-trips', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            def self.foo(a)
              while a < 3 && @x
                @x = false
              end
            end
        `,
        );
    });

    describe('the blocks treat the variable as Ruby does (only nil and false are false)', () => {
        const blocksOf = () => converter._context.blocks;

        // Evaluate a boolean block as the VM does (operators of scratch-vm).
        const evaluate = (blockId, value) => {
            const block = blocksOf()[blockId];
            const input = (name) => evaluate(block.inputs[name].block, value);
            switch (block.opcode) {
                case 'operator_not':
                    return !Cast.toBoolean(input('OPERAND'));
                case 'operator_and':
                    return Cast.toBoolean(input('OPERAND1')) && Cast.toBoolean(input('OPERAND2'));
                case 'operator_equals':
                    return Cast.compare(input('OPERAND1'), input('OPERAND2')) === 0;
                case 'operator_lt':
                    return Cast.compare(input('OPERAND1'), input('OPERAND2')) < 0;
                case 'data_variable':
                    return value;
                case 'text':
                    return block.fields.TEXT.value;
                default:
                    throw new Error(`unexpected block: ${block.opcode}`);
            }
        };

        const conditionOf = async (code) => {
            await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            const ifBlock = Object.values(blocksOf()).find((b) => b.opcode === 'control_if');
            return ifBlock.inputs.CONDITION.block;
        };

        test.each([
            [true, true],
            [false, false],
            [0, true],
            [1, true],
            ['', true],
            ['abc', true],
            ['0', true],
        ])('if @x with @x = %p is %p', async (value, expected) => {
            const condition = await conditionOf('if @x\n  move(10)\nend');
            expect(evaluate(condition, value)).toBe(expected);
        });

        test.each([
            [true, false],
            [false, true],
            [0, false],
            ['', false],
        ])('if !@x with @x = %p is %p', async (value, expected) => {
            const condition = await conditionOf('if !@x\n  move(10)\nend');
            expect(evaluate(condition, value)).toBe(expected);
        });
    });

    describe('blocks made by an older version', () => {
        // The older version made `not (x = (0 < 0))` with no mark on it, and marked the `if` / loop
        // with `@ruby:variable:@x`, even when the variable was only a part of the condition.
        const toOlderBlocks = () => {
            const context = converter._context;
            Object.values(context.blocks)
                .filter((b) => b.opcode === 'operator_not')
                .forEach((notBlock) => {
                    const comment = notBlock.comment && context.comments[notBlock.comment];
                    if (!comment || !comment.text.includes('@ruby:variable_condition')) return;
                    delete context.comments[notBlock.comment];
                    notBlock.comment = null;
                    const eqBlock = context.blocks[notBlock.inputs.OPERAND.block];
                    const varBlock = context.blocks[eqBlock.inputs.OPERAND1.block];
                    const textId = eqBlock.inputs.OPERAND2.block;
                    delete context.blocks[textId];
                    context.currentNode = null;
                    const ltBlock = converter._createBlock('operator_lt', 'value_boolean');
                    converter._addTextInput(ltBlock, 'OPERAND1', '0', '0');
                    converter._addTextInput(ltBlock, 'OPERAND2', '0', '0');
                    ltBlock.parent = eqBlock.id;
                    eqBlock.inputs.OPERAND2 = { name: 'OPERAND2', block: ltBlock.id, shadow: null };
                    const name = `@${context.variables[varBlock.fields.VARIABLE.value]?.name || 'x'}`;
                    const top = Object.values(context.blocks).find(
                        (b) => b.opcode === 'control_if' || b.opcode === 'control_repeat_until',
                    );
                    const topComment = top.comment && context.comments[top.comment];
                    if (topComment) {
                        topComment.text += `,@ruby:variable:${name}`;
                    } else {
                        top.comment = converter._createComment(`@ruby:variable:${name}`, top.id);
                    }
                });
        };

        const olderRoundTrip = async (code) => {
            await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            toOlderBlocks();
            await converter.applyTargetBlocks(target);
            RubyGenerator.currentTarget = target;
            return RubyGenerator.targetToCode(target, {}).trim();
        };

        test.each([
            'while @x\n  move(10)\nend',
            'until @x\n  move(10)\nend',
            'if @x\n  move(10)\nend',
            'move(10) if @x',
            'unless @x\n  move(10)\nend',
            'a = 1\nwhile a < 3 && @x\n  move(10)\nend',
        ])('%s is written back', async (code) => {
            expect(await olderRoundTrip(code)).toBe(code);
        });
    });
});
