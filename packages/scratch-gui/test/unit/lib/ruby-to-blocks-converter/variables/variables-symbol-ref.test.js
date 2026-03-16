import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';

describe('RubyToBlocksConverter/Variables/SymbolReference', () => {
    let converter;
    let target;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null, {version: '2'});
        target = null;
    });

    describe('_symbolToBlock', () => {
        test('creates data_itemnumoflist block', () => {
            converter.reset();
            const block = converter._symbolToBlock('foo', null);
            expect(block.opcode).toBe('data_itemnumoflist');
        });

        test('adds @ruby:symbol:name comment', () => {
            converter.reset();
            const block = converter._symbolToBlock('foo', null);
            const comment = converter._context.comments[block.comment];
            expect(comment).toBeDefined();
            expect(comment.text).toBe('@ruby:symbol:foo');
        });

        test('collects symbol', () => {
            converter.reset();
            converter._symbolToBlock('foo', null);
            expect(converter._context.symbols).toContain(':foo');
        });

        test('creates $_symbols_ list', () => {
            converter.reset();
            converter._symbolToBlock('foo', null);
            expect(converter.lists).toHaveProperty('_symbols_');
        });

        test('has ITEM input with colon-prefixed symbol name', () => {
            converter.reset();
            const block = converter._symbolToBlock('foo', null);
            expect(block.inputs).toHaveProperty('ITEM');
            const itemBlockId = block.inputs.ITEM.block;
            const itemBlock = converter._context.blocks[itemBlockId];
            expect(itemBlock.fields.TEXT.value).toBe('foo');
        });

        test('has LIST field referencing $_symbols_', () => {
            converter.reset();
            converter._symbolToBlock('foo', null);
            const list = converter.lists['_symbols_'];
            const block = converter._symbolToBlock('bar', null);
            expect(block.fields.LIST.value).toBe('_symbols_');
            expect(block.fields.LIST.id).toBe(list.id);
        });
    });

    describe('variable assignment with symbol', () => {
        test('$a = :foo creates data_setvariableto with data_itemnumoflist', async () => {
            const code = '$a = :foo';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBeTruthy();
            expect(converter.errors).toHaveLength(0);

            const blocks = Object.values(converter.blocks);
            const setVarBlock = blocks.find(b => b.opcode === 'data_setvariableto');
            expect(setVarBlock).toBeDefined();

            // The VALUE input should be a data_itemnumoflist block
            const valueBlockId = setVarBlock.inputs.VALUE.block;
            const valueBlock = converter.blocks[valueBlockId];
            expect(valueBlock.opcode).toBe('data_itemnumoflist');

            // Check symbol comment
            const comment = converter._context.comments[valueBlock.comment];
            expect(comment.text).toBe('@ruby:symbol:foo');
        });

        test('$a = :foo sets dataType to symbol', async () => {
            const code = '$a = :foo';
            await converter.targetCodeToBlocks(target, code);
            expect(converter.variables['a'].dataType).toBe('symbol');
        });

        test('a = :foo (local var) creates data_setvariableto with data_itemnumoflist', async () => {
            const code = 'a = :foo';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBeTruthy();
            expect(converter.errors).toHaveLength(0);

            const blocks = Object.values(converter.blocks);
            const setVarBlock = blocks.find(b => b.opcode === 'data_setvariableto');
            expect(setVarBlock).toBeDefined();

            const valueBlockId = setVarBlock.inputs.VALUE.block;
            const valueBlock = converter.blocks[valueBlockId];
            expect(valueBlock.opcode).toBe('data_itemnumoflist');
        });

        test('$_symbols_ list is created', async () => {
            const code = '$a = :foo';
            await converter.targetCodeToBlocks(target, code);
            expect(converter.lists).toHaveProperty('_symbols_');
        });

        test('symbols are collected', async () => {
            const code = [
                '$a = :foo',
                '$b = :bar'
            ].join('\n');
            await converter.targetCodeToBlocks(target, code);
            expect(Array.from(converter._context.symbols)).toEqual([':foo', ':bar']);
        });
    });

    describe('comparison with symbols', () => {
        test(':foo == :bar creates operator_equals with data_itemnumoflist', async () => {
            const code = ':foo == :bar';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBeTruthy();
            expect(converter.errors).toHaveLength(0);

            const blocks = Object.values(converter.blocks);
            const equalsBlock = blocks.find(b => b.opcode === 'operator_equals');
            expect(equalsBlock).toBeDefined();

            // Both operands should be data_itemnumoflist blocks
            const op1BlockId = equalsBlock.inputs.OPERAND1.block;
            const op1Block = converter.blocks[op1BlockId];
            expect(op1Block.opcode).toBe('data_itemnumoflist');

            const op2BlockId = equalsBlock.inputs.OPERAND2.block;
            const op2Block = converter.blocks[op2BlockId];
            expect(op2Block.opcode).toBe('data_itemnumoflist');
        });

        test('both symbols are collected', async () => {
            const code = ':foo == :bar';
            await converter.targetCodeToBlocks(target, code);
            expect(Array.from(converter._context.symbols)).toEqual([':foo', ':bar']);
        });
    });

    describe('event handlers still work', () => {
        test('self.when(:flag_clicked) works without error', async () => {
            const code = 'self.when(:flag_clicked) { move(10) }';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBeTruthy();
            expect(converter.errors).toHaveLength(0);

            const blocks = Object.values(converter.blocks);
            const hatBlock = blocks.find(b => b.opcode === 'event_whenflagclicked');
            expect(hatBlock).toBeDefined();
        });

        test('event handler symbols are not collected', async () => {
            const code = 'self.when(:flag_clicked) { move(10) }';
            await converter.targetCodeToBlocks(target, code);
            expect(converter._context.symbols.size).toBe(0);
        });

        test('$_symbols_ list is not created for event handler only', async () => {
            const code = 'self.when(:flag_clicked) { move(10) }';
            await converter.targetCodeToBlocks(target, code);
            expect(converter.lists).not.toHaveProperty('_symbols_');
        });
    });
});
