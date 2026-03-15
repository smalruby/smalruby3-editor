// === Smalruby: This file is Smalruby-specific (Ruby array syntax for local variable lists) ===
import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    expectedInfo
} from '../../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/Variables/ArraySyntax/Local', () => {
    let converter;
    let target;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null, {version: '2'});
        target = null;
    });

    describe('a - local variable array', () => {
        test('array literal a = ["a", "b"] generates clear + push blocks', async () => {
            const code = 'a = ["a", "b"]';
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            // Verify blocks were created (clear + 2 push blocks)
            const blockIds = Object.keys(converter.blocks);
            const blocks = blockIds.map(id => converter.blocks[id]);
            const clearBlock = blocks.find(b => b.opcode === 'data_deletealloflist');
            expect(clearBlock).toBeTruthy();

            const pushBlocks = blocks.filter(b => b.opcode === 'data_addtolist');
            expect(pushBlocks).toHaveLength(2);

            // Verify clear block comment includes both lvar and array literal info
            const clearComment = converter._context.comments[clearBlock.comment];
            expect(clearComment.text).toMatch(/@ruby:lvar:a:\d+/);
            expect(clearComment.text).toMatch(/@ruby:array:literal:2/);
        });

        test('a[0] with array literal creates data_itemoflist', async () => {
            const code = `
                a = ["a", "b"]
                say(a[0])
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            // Verify data_itemoflist block was created
            const blockIds = Object.keys(converter.blocks);
            const blocks = blockIds.map(id => converter.blocks[id]);
            const itemBlock = blocks.find(b => b.opcode === 'data_itemoflist');
            expect(itemBlock).toBeTruthy();

            // Verify the block has lvar comment
            const itemComment = converter._context.comments[itemBlock.comment];
            expect(itemComment.text).toMatch(/@ruby:lvar:a:\d+/);
        });

        test('a[variable_index] wraps in operator_add', async () => {
            const code = `
                a = ["a", "b"]
                @b = 1
                say(a[@b])
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            // Verify operator_add was created for the index
            const blockIds = Object.keys(converter.blocks);
            const blocks = blockIds.map(id => converter.blocks[id]);
            const addBlock = blocks.find(b => b.opcode === 'operator_add');
            expect(addBlock).toBeTruthy();

            const addComment = converter._context.comments[addBlock.comment];
            expect(addComment.text).toBe('@ruby:array:index');
        });

        test('a.push("c") works with local variable', async () => {
            const code = `
                a = ["a", "b"]
                a.push("c")
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            const blockIds = Object.keys(converter.blocks);
            const blocks = blockIds.map(id => converter.blocks[id]);
            // 2 push from literal + 1 standalone push
            const pushBlocks = blocks.filter(b => b.opcode === 'data_addtolist');
            expect(pushBlocks).toHaveLength(3);
        });

        test('a.length works with local variable', async () => {
            const code = `
                a = ["a", "b"]
                say(a.length)
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            const blockIds = Object.keys(converter.blocks);
            const blocks = blockIds.map(id => converter.blocks[id]);
            const lengthBlock = blocks.find(b => b.opcode === 'data_lengthoflist');
            expect(lengthBlock).toBeTruthy();
        });

        test('empty array literal a = [] generates clear only', async () => {
            const code = 'a = []';
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            const blockIds = Object.keys(converter.blocks);
            const blocks = blockIds.map(id => converter.blocks[id]);
            const clearBlock = blocks.find(b => b.opcode === 'data_deletealloflist');
            expect(clearBlock).toBeTruthy();

            const pushBlocks = blocks.filter(b => b.opcode === 'data_addtolist');
            expect(pushBlocks).toHaveLength(0);
        });
    });
});
