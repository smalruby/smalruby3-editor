import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';

describe('Class error message', () => {
    let converter;
    const target = null;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null);
    });

    test('invalid key inside class reports the statement, not the class', async () => {
        const code = 'class Sprite1\n  when_key_pressed("invalid") do\n  end\nend';
        await converter.targetCodeToBlocks(target, code);
        expect(converter.errors.length).toBeGreaterThan(0);
        expect(converter.errors[0].text).not.toMatch(/class Sprite1/);
        expect(converter.errors[0].text).toMatch(/when_key_pressed/);
    });

    test('non-hat block inside class mentions class definition in error', async () => {
        const code = 'class Sprite1\n  move(10)\nend';
        await converter.targetCodeToBlocks(target, code);
        expect(converter.errors.length).toBeGreaterThan(0);
        expect(converter.errors[0].text).toMatch(/move\(10\)/);
        expect(converter.errors[0].text).toMatch(/class definition/);
        expect(converter.errors[0].text).toMatch(/event block|when_flag_clicked|def/);
    });

    test('error message does not contain newlines', async () => {
        const code = 'class Sprite1\n  self.when(:flag_clicked) do\n    move(10)\n  end\n  move(10)\nend';
        await converter.targetCodeToBlocks(target, code);
        expect(converter.errors.length).toBeGreaterThan(0);
        expect(converter.errors[0].text).not.toMatch(/\n/);
    });

    test('error source is truncated', async () => {
        const code = 'when_key_pressed("invalid") do\nend';
        await converter.targetCodeToBlocks(target, code);
        expect(converter.errors.length).toBeGreaterThan(0);
        expect(converter.errors[0].source).not.toMatch(/\n/);
        expect(converter.errors[0].source).toMatch(/\.\.\.$/);
    });

    test('top-level wrongInstruction error has SOURCE expanded', async () => {
        const code = 'when_key_pressed("invalid") do\nend';
        await converter.targetCodeToBlocks(target, code);
        expect(converter.errors.length).toBeGreaterThan(0);
        // {SOURCE} placeholder should be replaced with actual source
        expect(converter.errors[0].text).not.toMatch(/\{SOURCE\}/);
        expect(converter.errors[0].text).toMatch(/when_key_pressed/);
    });
});
