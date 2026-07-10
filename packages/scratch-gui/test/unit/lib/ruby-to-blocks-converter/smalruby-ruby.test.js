import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import { convertAndExpectToEqualBlocks } from '../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/SmalrubyRuby', () => {
    let converter;
    let target;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null, { version: '2' });
        target = null;
    });

    describe('stringMethod', () => {
        test('should convert "hello".reverse', async () => {
            const code = '"hello".reverse';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);
            // Auto-split: COMMAND + returnValue REPORTER
            const blocks = Object.values(converter._context.blocks);
            const methodBlock = blocks.find(
                (b) => b.opcode === 'smalrubyRuby_stringMethod',
            );
            const rvBlock = blocks.find(
                (b) => b.opcode === 'smalrubyRuby_returnValue',
            );
            expect(methodBlock).toBeTruthy();
            expect(methodBlock.fields.METHOD.value).toBe('reverse');
            expect(rvBlock).toBeTruthy();
        });

        test('should convert "hello".delete("l")', async () => {
            const code = '"hello".delete("l")';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);
        });

        test('should convert "hello".gsub("l", "r")', async () => {
            const code = '"hello".gsub("l", "r")';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);
        });

        test('should convert "hello".upcase', async () => {
            const code = '"hello".upcase';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);
        });

        test('should convert "hello".downcase', async () => {
            const code = '"Hello".downcase';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);
        });

        test('should convert "hello\\nworld".lines', async () => {
            const code = '"hello\\nworld".lines';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);
        });
        test('should convert "Jimmy" * 5', async () => {
            const code = '"Jimmy" * 5';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);
            const blocks = Object.values(converter._context.blocks);
            const methodBlock = blocks.find(
                (b) => b.opcode === 'smalrubyRuby_stringMethod',
            );
            expect(methodBlock).toBeTruthy();
            expect(methodBlock.fields.METHOD.value).toBe('*');
        });
    });

    describe('arrayMethod', () => {
        test('should convert ticket.max', async () => {
            const code = 'ticket = [12, 47, 35]\nticket.max';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);
        });

        test('should convert ticket.sort', async () => {
            const code = 'ticket = [12, 47, 35]\nticket.sort';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);
        });

        test('should convert ticket.reverse', async () => {
            const code = 'ticket = [12, 47, 35]\nticket.reverse';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);
            const blocks = Object.values(converter._context.blocks);
            const methodBlock = blocks.find(
                (b) => b.opcode === 'smalrubyRuby_arrayMethod',
            );
            expect(methodBlock).toBeTruthy();
            expect(methodBlock.fields.METHOD.value).toBe('reverse');
            // No String#reverse block should be generated for a list variable.
            expect(
                blocks.find(
                    (b) => b.opcode === 'smalrubyRuby_stringMethod',
                ),
            ).toBeFalsy();
            // The receiver must be rewritten to a list read.
            const receiverBlock =
                converter._context.blocks[methodBlock.inputs.RECEIVER.block];
            expect(receiverBlock.opcode).toBe('data_listcontents');
        });

        test('should convert ticket.join(", ")', async () => {
            const code = 'ticket = [12, 47, 35]\nticket.join(", ")';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);
        });

        test('should convert ticket.first', async () => {
            const code = 'ticket = [12, 47, 35]\nticket.first';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);
        });

        test('should convert ticket.last', async () => {
            const code = 'ticket = [12, 47, 35]\nticket.last';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);
        });
    });

    describe('reverse disambiguation (String vs Array)', () => {
        const findOpcode = (opcode) =>
            Object.values(converter._context.blocks).find(
                (b) => b.opcode === opcode,
            );

        test('array (string) variable .reverse -> arrayMethod + list receiver', async () => {
            const code = 'ticket = ["赤", "青", "黄"]\nticket.reverse';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);
            const methodBlock = findOpcode('smalrubyRuby_arrayMethod');
            expect(methodBlock).toBeTruthy();
            expect(methodBlock.fields.METHOD.value).toBe('reverse');
            expect(findOpcode('smalrubyRuby_stringMethod')).toBeFalsy();
            const receiverBlock =
                converter._context.blocks[methodBlock.inputs.RECEIVER.block];
            expect(receiverBlock.opcode).toBe('data_listcontents');
        });

        test('string variable .reverse stays stringMethod (regression)', async () => {
            const code = 'name = "hello"\nname.reverse';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);
            const methodBlock = findOpcode('smalrubyRuby_stringMethod');
            expect(methodBlock).toBeTruthy();
            expect(methodBlock.fields.METHOD.value).toBe('reverse');
            expect(findOpcode('smalrubyRuby_arrayMethod')).toBeFalsy();
        });

        test('string literal .reverse stays stringMethod (regression)', async () => {
            const code = '"hello".reverse';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);
            expect(findOpcode('smalrubyRuby_stringMethod')).toBeTruthy();
            expect(findOpcode('smalrubyRuby_arrayMethod')).toBeFalsy();
        });

        test('array variable .reverse! -> arrayMethod', async () => {
            const code = 'ticket = [12, 47, 35]\nticket.reverse!';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);
            const methodBlock = findOpcode('smalrubyRuby_arrayMethod');
            expect(methodBlock).toBeTruthy();
            expect(methodBlock.fields.METHOD.value).toBe('reverse!');
            expect(findOpcode('smalrubyRuby_stringMethod')).toBeFalsy();
        });

        test('global array variable .reverse -> arrayMethod', async () => {
            const code = '$ticket = [12, 47, 35]\n$ticket.reverse';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);
            const methodBlock = findOpcode('smalrubyRuby_arrayMethod');
            expect(methodBlock).toBeTruthy();
            expect(methodBlock.fields.METHOD.value).toBe('reverse');
            expect(findOpcode('smalrubyRuby_stringMethod')).toBeFalsy();
        });
    });

    describe('hashMethod', () => {
        test('should convert books.keys', async () => {
            const code = 'books = {}\nbooks.keys';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);
        });

        test('should convert books.values', async () => {
            const code = 'books = {}\nbooks.values';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);
        });

    });

    describe('bare literals', () => {
        test('should convert bare string literal "Jimmy"', async () => {
            const code = '"Jimmy"';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);
            const blocks = Object.values(converter._context.blocks);
            const setBlock = blocks.find(
                (b) => b.opcode === 'data_setvariableto',
            );
            expect(setBlock).toBeTruthy();
            expect(setBlock.comment).toBeTruthy();
        });

        test('should convert bare integer literal 42', async () => {
            const code = '42';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);
        });

        test('should convert bare float literal 3.14', async () => {
            const code = '3.14';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);
        });

        test('should convert bare empty array []', async () => {
            const code = '[]';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);
        });

        test('should convert bare array [12, 47, 35]', async () => {
            const code = '[12, 47, 35]';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);
        });

        test('should still error on bare symbol :foo', async () => {
            const code = ':foo';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(false);
            expect(converter.errors.length).toBeGreaterThan(0);
        });
    });
});
