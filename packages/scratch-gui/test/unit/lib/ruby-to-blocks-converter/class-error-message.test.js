import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';

describe('Class error message', () => {
    const target = null;

    test('invalid key inside class reports the statement, not the class', async () => {
        // Class syntax requires version 2
        const converter = new RubyToBlocksConverter(null, {version: 2});
        const code = 'class Sprite1\n  when_key_pressed("invalid") do\n  end\nend';
        await converter.targetCodeToBlocks(target, code);
        expect(converter.errors.length).toBeGreaterThan(0);
        expect(converter.errors[0].text).not.toMatch(/class Sprite1/);
        expect(converter.errors[0].text).toMatch(/when_key_pressed/);
    });

    test('non-hat block inside class mentions class definition in error', async () => {
        // Class syntax requires version 2
        const converter = new RubyToBlocksConverter(null, {version: 2});
        const code = 'class Sprite1\n  move(10)\nend';
        await converter.targetCodeToBlocks(target, code);
        expect(converter.errors.length).toBeGreaterThan(0);
        expect(converter.errors[0].text).toMatch(/move\(10\)/);
        expect(converter.errors[0].text).toMatch(/class definition/);
        expect(converter.errors[0].text).toMatch(/event block|when_flag_clicked|def/);
    });

    test('error message does not contain source code newlines', async () => {
        // Class syntax requires version 2
        const converter = new RubyToBlocksConverter(null, {version: 2});
        const code = 'class Sprite1\n  when_flag_clicked do\n    move(10)\n  end\n  move(10)\nend';
        await converter.targetCodeToBlocks(target, code);
        expect(converter.errors.length).toBeGreaterThan(0);
        // The error part (before \n hint) should not contain newlines from source code
        const errorPart = converter.errors[0].text.split('\n')[0];
        expect(errorPart).not.toMatch(/\n/);
    });

    test('error source is truncated', async () => {
        const converter = new RubyToBlocksConverter(null, {version: '2'});
        const code = 'when_key_pressed("invalid") do\nend';
        await converter.targetCodeToBlocks(target, code);
        expect(converter.errors.length).toBeGreaterThan(0);
        expect(converter.errors[0].source).not.toMatch(/\n/);
        expect(converter.errors[0].source).toMatch(/\.\.\.$/);
    });

    test('top-level wrongInstruction error has SOURCE expanded', async () => {
        const converter = new RubyToBlocksConverter(null, {version: '2'});
        const code = 'when_key_pressed("invalid") do\nend';
        await converter.targetCodeToBlocks(target, code);
        expect(converter.errors.length).toBeGreaterThan(0);
        // {SOURCE} placeholder should be replaced with actual source
        expect(converter.errors[0].text).not.toMatch(/\{SOURCE\}/);
        expect(converter.errors[0].text).toMatch(/when_key_pressed/);
    });
});
