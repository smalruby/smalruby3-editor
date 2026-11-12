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
            const methodBlock = blocks.find((b) => b.opcode === 'smalrubyRuby_stringMethod');
            const rvBlock = blocks.find((b) => b.opcode === 'smalrubyRuby_returnValue');
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
            const methodBlock = blocks.find((b) => b.opcode === 'smalrubyRuby_stringMethod');
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
            const methodBlock = blocks.find((b) => b.opcode === 'smalrubyRuby_arrayMethod');
            expect(methodBlock).toBeTruthy();
            expect(methodBlock.fields.METHOD.value).toBe('reverse');
            // No String#reverse block should be generated for a list variable.
            expect(blocks.find((b) => b.opcode === 'smalrubyRuby_stringMethod')).toBeFalsy();
            // The receiver must be rewritten to a list read.
            const receiverBlock = converter._context.blocks[methodBlock.inputs.RECEIVER.block];
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

    // Issue #1621: an array literal cannot be the receiver of a block (Scratch has no
    // "list literal" reporter). It used to be dropped silently and come back as `""`.
    describe('array literal receiver (#1621)', () => {
        const cases = [
            ['[1, 2].each do |i|', 'each'],
            ['[1, 2].each do', 'each'],
            ['["a", "b"].each do |s|', 'each'],
            ['[].each do |i|', 'each'],
        ];
        test.each(cases)('should report an error on the line of %s', async (header, method) => {
            const code = `when_flag_clicked do\n  say(1)\n  ${header}\n    say(2)\n  end\nend`;
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(false);
            expect(converter.errors).toHaveLength(1);
            expect(converter.errors[0].row).toBe(2);
            expect(converter.errors[0].text).toContain(method);
            expect(converter.errors[0].text).toMatch(/variable/);
        });

        test.each(['first', 'last', 'max', 'min', 'sort', 'reverse', 'join'])(
            'should report an error for [1, 2].%s',
            async (method) => {
                const code = `when_flag_clicked do\n  say([1, 2].${method})\nend`;
                const result = await converter.targetCodeToBlocks(target, code);
                expect(result).toBe(false);
                expect(converter.errors).toHaveLength(1);
                expect(converter.errors[0].row).toBe(1);
                expect(converter.errors[0].text).toContain(method);
            },
        );

        test('should report an error for [1, 2].join(", ")', async () => {
            const code = 'when_flag_clicked do\n  say([1, 2].join(", "))\nend';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(false);
            expect(converter.errors[0].row).toBe(1);
            expect(converter.errors[0].text).toContain('join');
        });

        test('should report the error in Ruby version 1 too', async () => {
            converter = new RubyToBlocksConverter(null, { version: '1' });
            const code = 'when_flag_clicked do\n  [1, 2].each do |i|\n    say(i)\n  end\nend';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(false);
            expect(converter.errors[0].row).toBe(1);
            expect(converter.errors[0].text).toContain('each');
        });
    });

    // Issue #1625: a hash literal cannot be the receiver of a hash method (Scratch has no
    // "hash literal" reporter). `{a: 1}.keys` used to come back as `"".keys`.
    describe('hash literal receiver (#1625)', () => {
        test.each([
            ['say({a: 1}.keys)', 'keys'],
            ['say({"a" => 1}.values)', 'values'],
            ['say({}.keys)', 'keys'],
            ['say({a: 1}.keys.length)', 'keys'],
            ['say({"a" => 1}.keys.join(","))', 'keys'],
            ['@a = {"a" => 1}.keys', 'keys'],
        ])('should report an error on the line of %s', async (line, method) => {
            const code = `when_flag_clicked do\n  say(1)\n  ${line}\nend`;
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(false);
            expect(converter.errors).toHaveLength(1);
            expect(converter.errors[0].row).toBe(2);
            expect(converter.errors[0].text).toContain(method);
            expect(converter.errors[0].text).toMatch(/hash literal/);
            expect(converter.errors[0].text).toMatch(/variable/);
        });

        test('should report an error for {a: 1}.each do |k, v|', async () => {
            const code = 'when_flag_clicked do\n  {a: 1}.each do |k, v|\n    say(k)\n  end\nend';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(false);
            expect(converter.errors).toHaveLength(1);
            expect(converter.errors[0].row).toBe(1);
            expect(converter.errors[0].text).toContain('each');
            expect(converter.errors[0].text).toMatch(/hash literal/);
        });

        test('should report the error in Ruby version 1 too', async () => {
            converter = new RubyToBlocksConverter(null, { version: '1' });
            const code = 'when_flag_clicked do\n  say({a: 1}.keys)\nend';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(false);
            expect(converter.errors[0].row).toBe(1);
            expect(converter.errors[0].text).toContain('keys');
        });

        test('should still convert keys / values on a hash variable', async () => {
            const code = 'when_flag_clicked do\n  @h = {a: 1}\n  say(@h.keys)\n  say(@h.values)\nend';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toEqual([]);
            expect(result).toBe(true);
            const methods = Object.values(converter._context.blocks)
                .filter((b) => b.opcode === 'smalrubyRuby_hashMethod')
                .map((b) => b.fields.METHOD.value);
            expect(methods.sort()).toEqual(['keys', 'values']);
        });
    });

    describe('reverse disambiguation (String vs Array)', () => {
        const findOpcode = (opcode) => Object.values(converter._context.blocks).find((b) => b.opcode === opcode);

        test('array (string) variable .reverse -> arrayMethod + list receiver', async () => {
            const code = 'ticket = ["赤", "青", "黄"]\nticket.reverse';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);
            const methodBlock = findOpcode('smalrubyRuby_arrayMethod');
            expect(methodBlock).toBeTruthy();
            expect(methodBlock.fields.METHOD.value).toBe('reverse');
            expect(findOpcode('smalrubyRuby_stringMethod')).toBeFalsy();
            const receiverBlock = converter._context.blocks[methodBlock.inputs.RECEIVER.block];
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
            const setBlock = blocks.find((b) => b.opcode === 'data_setvariableto');
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
