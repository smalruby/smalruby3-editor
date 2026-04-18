import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    convertAndExpectRubyBlockError,
    expectedInfo
} from '../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/SmalrubyRuby', () => {
    let converter;
    let target;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null, {version: '2'});
        target = null;
    });

    describe('String#reverse (REPORTER, 0 args)', () => {
        test('should convert string literal receiver', async () => {
            const code = '"Jimmy".reverse';
            const expected = [
                {
                    opcode: 'smalrubyRuby_methodR',
                    fields: [
                        {name: 'METHOD', value: 'reverse'}
                    ],
                    inputs: [
                        {name: 'STRING', block: expectedInfo.makeText('Jimmy')}
                    ],
                    mutation: {blockInfo: expect.any(Object)}
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('should convert variable receiver', async () => {
            const code = 'name = "Jimmy"\nname.reverse';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);
        });

        test('should reject with arguments', async () => {
            await convertAndExpectRubyBlockError(converter, target, '"hello".reverse("x")');
        });
    });

    describe('String#delete (REPORTER)', () => {
        test('should convert string literal receiver with string arg', async () => {
            const code = '"hello world".delete("l")';
            const expected = [
                {
                    opcode: 'smalrubyRuby_methodR',
                    fields: [
                        {name: 'METHOD', value: 'delete'}
                    ],
                    inputs: [
                        {name: 'STRING', block: expectedInfo.makeText('hello world')},
                        {name: 'ARG1', block: expectedInfo.makeText('l')}
                    ],
                    mutation: {blockInfo: expect.any(Object)}
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('should reject wrong number of arguments', async () => {
            await convertAndExpectRubyBlockError(converter, target, '"hello".delete()');
            await convertAndExpectRubyBlockError(converter, target, '"hello".delete("l", "o")');
        });
    });

    describe('String#gsub (REPORTER, 2 args)', () => {
        test('should convert with pattern and replacement', async () => {
            const code = '"hello world".gsub("l", "r")';
            const expected = [
                {
                    opcode: 'smalrubyRuby_methodR',
                    fields: [
                        {name: 'METHOD', value: 'gsub'}
                    ],
                    inputs: [
                        {name: 'STRING', block: expectedInfo.makeText('hello world')},
                        {name: 'ARG1', block: expectedInfo.makeText('l')},
                        {name: 'ARG2', block: expectedInfo.makeText('r')}
                    ],
                    mutation: {blockInfo: expect.any(Object)}
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('should reject wrong number of arguments', async () => {
            await convertAndExpectRubyBlockError(converter, target, '"hello".gsub("l")');
            await convertAndExpectRubyBlockError(converter, target, '"hello".gsub("l", "r", "x")');
        });
    });

    describe('String#delete! (COMMAND)', () => {
        test('should reject string literal receiver', async () => {
            await convertAndExpectRubyBlockError(converter, target, '"hello".delete!("l")');
        });

        test('should reject wrong number of arguments', async () => {
            await convertAndExpectRubyBlockError(converter, target, '"hello".delete!()');
            await convertAndExpectRubyBlockError(converter, target, '"hello".delete!("l", "o")');
        });
    });

    describe('String#gsub! (COMMAND, 2 args)', () => {
        test('should reject string literal receiver', async () => {
            await convertAndExpectRubyBlockError(converter, target, '"hello".gsub!("l", "r")');
        });

        test('should reject wrong number of arguments', async () => {
            await convertAndExpectRubyBlockError(converter, target, '"hello".gsub!("l")');
        });
    });

    describe('New methods (Phase 1 #4-#9)', () => {
        test('String#lines should convert', async () => {
            const code = '"hello\\nworld".lines';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);
        });

        test('Array#max should convert', async () => {
            const code = 'ticket = [12, 47, 35]\nticket.max';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);
        });

        test('Array#sort should convert', async () => {
            const code = 'ticket = [12, 47, 35]\nticket.sort';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);
        });

        test('Array#join should convert without args', async () => {
            const code = 'ticket = [12, 47, 35]\nticket.join';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);
        });

        test('Array#join should convert with separator arg', async () => {
            const code = 'ticket = [12, 47, 35]\nticket.join(", ")';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);
        });

        test('Hash#keys should convert', async () => {
            const code = 'books = {}\nbooks.keys';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);
        });

        test('Hash#values should convert', async () => {
            const code = 'books = {}\nbooks.values';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);
        });
    });
});
