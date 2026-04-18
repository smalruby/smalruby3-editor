import {targetCodeToBlocks} from '../../../../src/lib/ruby-to-blocks-converter';
import {loadPrism} from '../../../../src/lib/prism-parser';

describe('RubyToBlocksConverter Core (Prism)', () => {
    let vm;
    let target;

    beforeAll(async () => {
        await loadPrism();
    });

    beforeEach(() => {
        vm = {
            runtime: {
                getEditingTarget: () => target,
                getTargetForStage: () => ({id: 'stage'})
            }
        };
        target = {
            id: 'sprite1',
            isStage: false,
            variables: {},
            lists: {}
        };
    });

    test('it should convert move(10) to motion_movesteps block', async () => {
        const code = 'move(10)';
        const converter = await targetCodeToBlocks(vm, target, code);
        expect(converter.result).toBeTruthy();
        const blocks = Object.values(converter.blocks);
        const moveBlock = blocks.find(b => b.opcode === 'motion_movesteps');
        expect(moveBlock).toBeDefined();
        const stepsBlock = converter.blocks[moveBlock.inputs.STEPS.block];
        expect(stepsBlock.fields.NUM.value).toBe('10');
    });

    test('bare integer is accepted (converted to temp variable)', async () => {
        const code = '10';
        const converter = await targetCodeToBlocks(vm, target, code);
        expect(converter.result).toBeTruthy();
    });

    test('bare string is accepted (converted to temp variable)', async () => {
        const code = '"hello"';
        const converter = await targetCodeToBlocks(vm, target, code);
        expect(converter.result).toBeTruthy();
    });

    test('float literal 1.0 should be stored as "1.0" in NUM field', async () => {
        const code = 'move(1.0)';
        const converter = await targetCodeToBlocks(vm, target, code);
        expect(converter.result).toBeTruthy();
        const blocks = Object.values(converter.blocks);
        const moveBlock = blocks.find(b => b.opcode === 'motion_movesteps');
        expect(moveBlock).toBeDefined();
        const stepsBlock = converter.blocks[moveBlock.inputs.STEPS.block];
        expect(stepsBlock.fields.NUM.value).toBe('1.0');
    });

    test('float literal 3435.0 should be stored as "3435.0" in NUM field', async () => {
        const code = 'move(3435.0)';
        const converter = await targetCodeToBlocks(vm, target, code);
        expect(converter.result).toBeTruthy();
        const blocks = Object.values(converter.blocks);
        const moveBlock = blocks.find(b => b.opcode === 'motion_movesteps');
        expect(moveBlock).toBeDefined();
        const stepsBlock = converter.blocks[moveBlock.inputs.STEPS.block];
        expect(stepsBlock.fields.NUM.value).toBe('3435.0');
    });

    describe('unless and modifier comment annotations', () => {
        const getCommentText = (converter, block) => {
            if (!block.comment) return null;
            const comment = converter._context.comments[block.comment];
            return comment ? comment.text : null;
        };

        test('unless...end attaches @ruby:syntax:unless comment', async () => {
            const code = 'unless touching?("_edge_")\n  move(10)\nend';
            const converter = await targetCodeToBlocks(vm, target, code);
            expect(converter.result).toBeTruthy();
            const blocks = Object.values(converter.blocks);
            const ifBlock = blocks.find(b => b.opcode === 'control_if');
            expect(ifBlock).toBeDefined();
            expect(getCommentText(converter, ifBlock)).toBe('@ruby:syntax:unless');
        });

        test('unless...else...end attaches @ruby:syntax:unless_else comment', async () => {
            const code = 'unless touching?("_edge_")\n  move(10)\nelse\n  turn_right(180)\nend';
            const converter = await targetCodeToBlocks(vm, target, code);
            expect(converter.result).toBeTruthy();
            const blocks = Object.values(converter.blocks);
            const ifBlock = blocks.find(b => b.opcode === 'control_if_else');
            expect(ifBlock).toBeDefined();
            expect(getCommentText(converter, ifBlock)).toBe('@ruby:syntax:unless_else');
        });

        test('if modifier attaches @ruby:syntax:if_modifier comment', async () => {
            const code = 'move(10) if true';
            const converter = await targetCodeToBlocks(vm, target, code);
            expect(converter.result).toBeTruthy();
            const blocks = Object.values(converter.blocks);
            const ifBlock = blocks.find(b => b.opcode === 'control_if');
            expect(ifBlock).toBeDefined();
            expect(getCommentText(converter, ifBlock)).toBe('@ruby:syntax:if_modifier');
        });

        test('unless modifier attaches @ruby:syntax:unless_modifier comment', async () => {
            const code = 'move(10) unless true';
            const converter = await targetCodeToBlocks(vm, target, code);
            expect(converter.result).toBeTruthy();
            const blocks = Object.values(converter.blocks);
            const ifBlock = blocks.find(b => b.opcode === 'control_if');
            expect(ifBlock).toBeDefined();
            expect(getCommentText(converter, ifBlock)).toBe('@ruby:syntax:unless_modifier');
        });
    });
});
