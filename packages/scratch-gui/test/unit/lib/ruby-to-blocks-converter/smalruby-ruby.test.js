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
            const expected = [
                {
                    opcode: 'smalrubyRuby_stringMethod',
                    fields: [{ name: 'METHOD', value: 'reverse' }],
                    mutation: { blockInfo: expect.any(Object) },
                },
            ];
            await convertAndExpectToEqualBlocks(
                converter,
                target,
                code,
                expected,
            );
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

        test('should convert "".empty?', async () => {
            const code = '"".empty?';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);
        });

        test('should convert "hello\\nworld".lines', async () => {
            const code = '"hello\\nworld".lines';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);
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

        test('should convert books.empty?', async () => {
            const code = 'books = {}\nbooks.empty?';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);
        });
    });
});
