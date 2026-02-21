import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    rubyToExpected
} from '../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/MakeyMakey', () => {
    let converter;
    let target;
    let code;
    let expected;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null);
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
                        fields: [{name: 'KEY', value: 'SPACE'}],
                        shadow: true
                    }
                }
            ],
            branches: [null]
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
                        fields: [{name: 'SEQUENCE', value: 'LEFT UP RIGHT'}],
                        shadow: true
                    }
                }
            ],
            branches: [null]
        };
        expected = [expectedBlock];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });
});
