import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';

describe('RubyToBlocksConverter/Variables/SymbolVarSay', () => {
    let converter;
    let target;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null, {version: '2'});
        target = null;
    });

    describe('say($a) where $a is a symbol', () => {
        test('creates looks_say with data_itemoflist wrapping variable', async () => {
            const code = '$a = :foo\nsay($a)';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBeTruthy();
            expect(converter.errors).toHaveLength(0);

            const blocks = Object.values(converter.blocks);
            const sayBlock = blocks.find(b => b.opcode === 'looks_say');
            expect(sayBlock).toBeDefined();

            // MESSAGE should be a data_itemoflist block (not direct variable)
            const msgBlockId = sayBlock.inputs.MESSAGE.block;
            const msgBlock = converter.blocks[msgBlockId];
            expect(msgBlock.opcode).toBe('data_itemoflist');

            // data_itemoflist should have @ruby:symbol:var comment
            const comment = converter._context.comments[msgBlock.comment];
            expect(comment.text).toBe('@ruby:symbol:var');

            // INDEX should be the variable block
            const indexBlockId = msgBlock.inputs.INDEX.block;
            const indexBlock = converter.blocks[indexBlockId];
            expect(indexBlock.opcode).toBe('data_variable');
        });

        test('say($a, 2) with symbol variable wraps in data_itemoflist', async () => {
            const code = '$a = :foo\nsay($a, 2)';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBeTruthy();
            expect(converter.errors).toHaveLength(0);

            const blocks = Object.values(converter.blocks);
            const sayBlock = blocks.find(b => b.opcode === 'looks_sayforsecs');
            expect(sayBlock).toBeDefined();

            const msgBlockId = sayBlock.inputs.MESSAGE.block;
            const msgBlock = converter.blocks[msgBlockId];
            expect(msgBlock.opcode).toBe('data_itemoflist');
        });

        test('think($a) with symbol variable wraps in data_itemoflist', async () => {
            const code = '$a = :foo\nthink($a)';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBeTruthy();
            expect(converter.errors).toHaveLength(0);

            const blocks = Object.values(converter.blocks);
            const thinkBlock = blocks.find(b => b.opcode === 'looks_think');
            expect(thinkBlock).toBeDefined();

            const msgBlockId = thinkBlock.inputs.MESSAGE.block;
            const msgBlock = converter.blocks[msgBlockId];
            expect(msgBlock.opcode).toBe('data_itemoflist');
        });

        test('puts($a) with symbol variable wraps in data_itemoflist', async () => {
            const code = '$a = :foo\nputs($a)';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBeTruthy();
            expect(converter.errors).toHaveLength(0);

            const blocks = Object.values(converter.blocks);
            const sayForSecsBlock = blocks.find(b => b.opcode === 'looks_sayforsecs');
            expect(sayForSecsBlock).toBeDefined();

            const msgBlockId = sayForSecsBlock.inputs.MESSAGE.block;
            const msgBlock = converter.blocks[msgBlockId];
            expect(msgBlock.opcode).toBe('data_itemoflist');
        });
    });

    describe('say($a) where $a is NOT a symbol', () => {
        test('say($a) with string variable does NOT wrap in data_itemoflist', async () => {
            const code = '$a = "hello"\nsay($a)';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBeTruthy();

            const blocks = Object.values(converter.blocks);
            const sayBlock = blocks.find(b => b.opcode === 'looks_say');
            expect(sayBlock).toBeDefined();

            const msgBlockId = sayBlock.inputs.MESSAGE.block;
            const msgBlock = converter.blocks[msgBlockId];
            expect(msgBlock.opcode).toBe('data_variable');
        });
    });

    describe('$_symbols_ stores symbol names without colon', () => {
        test('_symbolToBlock ITEM is "foo" not ":foo"', () => {
            converter.reset();
            const block = converter._symbolToBlock('foo', null);
            const itemBlockId = block.inputs.ITEM.block;
            const itemBlock = converter._context.blocks[itemBlockId];
            expect(itemBlock.fields.TEXT.value).toBe('foo');
        });
    });

    describe('round-trip with symbol variable', () => {
        test('$a = :foo then say($a) round-trips', async () => {
            const code = '$a = :foo\nsay($a)';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBeTruthy();
            expect(converter.errors).toHaveLength(0);
        });
    });
});
