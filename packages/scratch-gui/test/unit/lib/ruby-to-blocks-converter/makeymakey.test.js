import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import { convertAndExpectToEqualBlocks, rubyToExpected } from '../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/MakeyMakey', () => {
    let converter;
    let target;
    let code;
    let expected;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null, { version: '2' });
        target = null;
        code = null;
        expected = null;
    });

    test('backward compatibility: when(:makey_key_pressed, ...)', async () => {
        code = `self.when(:makey_key_pressed, "SPACE") do
end`;
        const expectedBlock = {
            opcode: 'makeymakey_whenMakeyKeyPressed',
            inputs: [
                {
                    name: 'KEY',
                    block: {
                        opcode: 'makeymakey_menu_KEY',
                        fields: [{ name: 'KEY', value: 'SPACE' }],
                        shadow: true,
                    },
                },
            ],
            branches: [null],
        };
        expected = [expectedBlock];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('backward compatibility: when(:makey_pressed_in_oder, ...)', async () => {
        code = `self.when(:makey_pressed_in_oder, "LEFT UP RIGHT") do
end`;
        const expectedBlock = {
            opcode: 'makeymakey_whenCodePressed',
            inputs: [
                {
                    name: 'SEQUENCE',
                    block: {
                        opcode: 'makeymakey_menu_SEQUENCE',
                        fields: [{ name: 'SEQUENCE', value: 'LEFT UP RIGHT' }],
                        shadow: true,
                    },
                },
            ],
            branches: [null],
        };
        expected = [expectedBlock];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('backward compatibility: when(:makey_pressed_in_oder, ...) puts the body under the hat', async () => {
        code = `self.when(:makey_pressed_in_oder, "LEFT UP RIGHT") do
  move(10)
end`;
        expected = await rubyToExpected(
            converter,
            target,
            `makey.when_pressed_in_oder("LEFT UP RIGHT") do
  move(10)
end`,
        );
        expect(expected.map((block) => block.opcode)).toEqual(['makeymakey_whenCodePressed']);
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    // The hats take no block parameters: `do |a|` is the wrong instruction, not dropped (issue #1909).
    test.each([
        ['self.when(:makey_key_pressed, "SPACE") do |a|', 'self.when(:makey_key_pressed, "SPACE") d...'],
        ['self.when(:makey_pressed_in_oder, "LEFT UP RIGHT") do |a|', 'self.when(:makey_pressed_in_oder, "LEFT ...'],
    ])('backward compatibility: %s is the wrong instruction', async (line, source) => {
        const ok = await converter.targetCodeToBlocks(target, `${line}\n  move(10)\nend`);
        expect(ok).toBe(false);
        expect(converter.errors).toHaveLength(1);
        expect(converter.errors[0].text).toContain(`"${source}" is the wrong instruction.`);
        expect(Object.values(converter.blocks).map((block) => block.opcode)).not.toContain(
            line.includes('key_pressed') ? 'makeymakey_whenMakeyKeyPressed' : 'makeymakey_whenCodePressed',
        );
    });
});
