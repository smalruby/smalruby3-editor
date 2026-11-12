import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';

describe('Error message resolution hints', () => {
    const target = null;

    test('wrongInstruction error includes hint', async () => {
        const converter = new RubyToBlocksConverter(null, { version: '2' });
        const code = 'when_key_pressed("invalid") do\nend';
        await converter.targetCodeToBlocks(target, code);
        expect(converter.errors.length).toBeGreaterThan(0);
        expect(converter.errors[0].text).toMatch(/Check the spelling/);
    });

    test('wrongInstructionInClass error includes hint', async () => {
        // Class syntax requires version 2
        const converter = new RubyToBlocksConverter(null, { version: 2 });
        const code = 'class Sprite1\n  move(10)\nend';
        await converter.targetCodeToBlocks(target, code);
        expect(converter.errors.length).toBeGreaterThan(0);
        expect(converter.errors[0].text).toMatch(/event block|when_flag_clicked|def/);
    });

    test('conditionIsNotBoolean error includes hint', async () => {
        // Class syntax requires version 2
        const converter = new RubyToBlocksConverter(null, { version: 2 });
        const code = 'class Sprite1\n  when_flag_clicked do\n    if 42\n      move(10)\n    end\n  end\nend';
        await converter.targetCodeToBlocks(target, code);
        expect(converter.errors.length).toBeGreaterThan(0);
        expect(converter.errors[0].text).toMatch(/comparison operator|==|<|>/);
    });

    test('defInsideBlock error tells to move the whole method out', async () => {
        // Class syntax requires version 2
        const converter = new RubyToBlocksConverter(null, { version: 2 });
        const code = [
            'class Sprite1',
            '  when_flag_clicked do',
            '    def my_proc',
            '      123',
            '    end',
            '  end',
            'end',
        ].join('\n');
        await converter.targetCodeToBlocks(target, code);
        expect(converter.errors.length).toBeGreaterThan(0);
        expect(converter.errors[0].text).toMatch(/"def my_proc" defines a method/);
        expect(converter.errors[0].text).toMatch(/Move the whole method, from "def my_proc" to its "end"/);
    });

    test('includeNotStatementBlocks error tells how to fix the line', async () => {
        const converter = new RubyToBlocksConverter(null, { version: 2 });
        const code = 'class Sprite1\n  when_flag_clicked do\n    :my_proc\n  end\nend';
        await converter.targetCodeToBlocks(target, code);
        expect(converter.errors.length).toBeGreaterThan(0);
        expect(converter.errors[0].text).toMatch(/":my_proc" is not a command/);
        expect(converter.errors[0].text).toMatch(/Write a command \(e\.g\. move\(10\)\) instead/);
    });

    test('eventInsideBlock error tells where to move the event', async () => {
        const converter = new RubyToBlocksConverter(null, { version: 2 });
        const code = 'when_flag_clicked do\n  move(10)\n  when_clicked do\n  end\nend';
        await converter.targetCodeToBlocks(target, code);
        expect(converter.errors.length).toBeGreaterThan(0);
        expect(converter.errors[0].text).toMatch(/is an event/);
        expect(converter.errors[0].text).toMatch(/Move it out of the block/);
    });

    test('valueAsStatement error tells how to use the value', async () => {
        const converter = new RubyToBlocksConverter(null, { version: 2 });
        const code = 'when_flag_clicked do\n  move(10)\n  x\nend';
        await converter.targetCodeToBlocks(target, code);
        expect(converter.errors.length).toBeGreaterThan(0);
        expect(converter.errors[0].text).toMatch(/is a value/);
        expect(converter.errors[0].text).toMatch(/say\(x\)/);
    });

    test('visibilityDefNotSupported error tells to delete private and keep the method', async () => {
        const converter = new RubyToBlocksConverter(null, { version: 2 });
        const code = 'class Sprite1\n  private def my_proc\n    move(10)\n  end\nend';
        await converter.targetCodeToBlocks(target, code);
        expect(converter.errors.length).toBeGreaterThan(0);
        expect(converter.errors[0].text).toMatch(/"private" is not supported in Smalruby/);
        expect(converter.errors[0].text).toMatch(/Delete "private"\. Then the method from "def my_proc"/);
    });
});
