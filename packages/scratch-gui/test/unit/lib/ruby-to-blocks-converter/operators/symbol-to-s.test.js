import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';

describe('RubyToBlocksConverter/Operators/SymbolToS', () => {
    let converter;
    let target;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null, {version: '2'});
        target = null;
    });

    describe(':symbol.to_s', () => {
        test(':foo.to_s creates operator_join with symbol name', async () => {
            const code = 'say(:foo.to_s)';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBeTruthy();
            expect(converter.errors).toHaveLength(0);

            const blocks = Object.values(converter.blocks);
            const joinBlock = blocks.find(b => b.opcode === 'operator_join');
            expect(joinBlock).toBeDefined();

            // STRING1 should be "foo" (symbol name without colon)
            const str1BlockId = joinBlock.inputs.STRING1.block;
            const str1Block = converter.blocks[str1BlockId];
            expect(str1Block.fields.TEXT.value).toBe('foo');

            // STRING2 should be empty
            const str2BlockId = joinBlock.inputs.STRING2.block;
            const str2Block = converter.blocks[str2BlockId];
            expect(str2Block.fields.TEXT.value).toBe('');
        });

        test(':foo.to_s has @ruby:symbol:foo comment', async () => {
            const code = 'say(:foo.to_s)';
            await converter.targetCodeToBlocks(target, code);

            const blocks = Object.values(converter.blocks);
            const joinBlock = blocks.find(b => b.opcode === 'operator_join');
            const comment = converter._context.comments[joinBlock.comment];
            expect(comment.text).toBe('@ruby:symbol:foo');
        });

        test(':foo.to_s collects symbol', async () => {
            const code = 'say(:foo.to_s)';
            await converter.targetCodeToBlocks(target, code);
            expect(converter._context.symbols).toContain(':foo');
        });

        test(':foo.to_s creates $_symbols_ list', async () => {
            const code = 'say(:foo.to_s)';
            await converter.targetCodeToBlocks(target, code);
            expect(converter.lists).toHaveProperty('_symbols_');
        });

        test('multiple :symbol.to_s collects all symbols', async () => {
            const code = [
                'say(:foo.to_s)',
                'say(:bar.to_s)'
            ].join('\n');
            await converter.targetCodeToBlocks(target, code);
            expect(Array.from(converter._context.symbols)).toEqual([':foo', ':bar']);
        });
    });
});
