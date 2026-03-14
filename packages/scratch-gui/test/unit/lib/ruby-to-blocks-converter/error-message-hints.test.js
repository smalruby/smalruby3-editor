import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';

describe('Error message resolution hints', () => {
    const target = null;

    test('wrongInstruction error includes hint', async () => {
        const converter = new RubyToBlocksConverter(null, {version: '2'});
        const code = 'when_key_pressed("invalid") do\nend';
        await converter.targetCodeToBlocks(target, code);
        expect(converter.errors.length).toBeGreaterThan(0);
        expect(converter.errors[0].text).toMatch(/Check the spelling/);
    });

    test('wrongInstructionInClass error includes hint', async () => {
        // Class syntax requires version 2
        const converter = new RubyToBlocksConverter(null, {version: 2});
        const code = 'class Sprite1\n  move(10)\nend';
        await converter.targetCodeToBlocks(target, code);
        expect(converter.errors.length).toBeGreaterThan(0);
        expect(converter.errors[0].text).toMatch(/event block|when_flag_clicked|def/);
    });

    test('conditionIsNotBoolean error includes hint', async () => {
        // Class syntax requires version 2
        const converter = new RubyToBlocksConverter(null, {version: 2});
        const code = 'class Sprite1\n  when_flag_clicked do\n    if 42\n      move(10)\n    end\n  end\nend';
        await converter.targetCodeToBlocks(target, code);
        expect(converter.errors.length).toBeGreaterThan(0);
        expect(converter.errors[0].text).toMatch(/comparison operator|==|<|>/);
    });

    test('includeNotStatementBlocks error includes hint', async () => {
        // Class syntax requires version 2
        const converter = new RubyToBlocksConverter(null, {version: 2});
        const code = [
            'class Sprite1',
            '  when_flag_clicked do',
            '    def my_proc',
            '      123',
            '    end',
            '  end',
            'end'
        ].join('\n');
        await converter.targetCodeToBlocks(target, code);
        expect(converter.errors.length).toBeGreaterThan(0);
        expect(converter.errors[0].text).toMatch(/statement blocks/);
        expect(converter.errors[0].text).toMatch(/commands/);
    });
});
