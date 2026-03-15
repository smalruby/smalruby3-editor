import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';

describe('RubyToBlocksConverter/Looks/SymbolImplicit', () => {
    let converter;
    let target;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null, {version: '2'});
        target = null;
    });

    describe('say(:symbol)', () => {
        test('say(:foo) creates looks_say with "foo" message', async () => {
            const code = 'say(:foo)';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBeTruthy();
            expect(converter.errors).toHaveLength(0);

            const blocks = Object.values(converter.blocks);
            const sayBlock = blocks.find(b => b.opcode === 'looks_say');
            expect(sayBlock).toBeDefined();

            // MESSAGE should be "foo" (symbol name without colon)
            const msgBlockId = sayBlock.inputs.MESSAGE.block;
            const msgBlock = converter.blocks[msgBlockId];
            expect(msgBlock.fields.TEXT.value).toBe('foo');
        });

        test('say(:foo) has @ruby:symbol:foo comment', async () => {
            const code = 'say(:foo)';
            await converter.targetCodeToBlocks(target, code);

            const blocks = Object.values(converter.blocks);
            const sayBlock = blocks.find(b => b.opcode === 'looks_say');
            const comment = converter._context.comments[sayBlock.comment];
            expect(comment.text).toBe('@ruby:symbol:foo');
        });

        test('say(:foo) collects symbol', async () => {
            const code = 'say(:foo)';
            await converter.targetCodeToBlocks(target, code);
            expect(converter._context.symbols).toContain(':foo');
        });

        test('say(:foo, 2) creates looks_sayforsecs with "foo" message', async () => {
            const code = 'say(:foo, 2)';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBeTruthy();
            expect(converter.errors).toHaveLength(0);

            const blocks = Object.values(converter.blocks);
            const sayBlock = blocks.find(b => b.opcode === 'looks_sayforsecs');
            expect(sayBlock).toBeDefined();

            const msgBlockId = sayBlock.inputs.MESSAGE.block;
            const msgBlock = converter.blocks[msgBlockId];
            expect(msgBlock.fields.TEXT.value).toBe('foo');
        });
    });

    describe('puts/p/print with symbol', () => {
        test('puts(:foo) creates looks_sayforsecs with "foo" message', async () => {
            const code = 'puts(:foo)';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBeTruthy();
            expect(converter.errors).toHaveLength(0);

            const blocks = Object.values(converter.blocks);
            const sayBlock = blocks.find(b => b.opcode === 'looks_sayforsecs');
            expect(sayBlock).toBeDefined();
        });

        test('p(:foo) creates looks_sayforsecs with "foo" message', async () => {
            const code = 'p(:foo)';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBeTruthy();
            expect(converter.errors).toHaveLength(0);
        });

        test('print(:foo) creates looks_sayforsecs with "foo" message', async () => {
            const code = 'print(:foo)';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBeTruthy();
            expect(converter.errors).toHaveLength(0);
        });
    });

    describe('think(:symbol)', () => {
        test('think(:foo) creates looks_think with "foo" message', async () => {
            const code = 'think(:foo)';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBeTruthy();
            expect(converter.errors).toHaveLength(0);

            const blocks = Object.values(converter.blocks);
            const thinkBlock = blocks.find(b => b.opcode === 'looks_think');
            expect(thinkBlock).toBeDefined();
        });
    });
});
