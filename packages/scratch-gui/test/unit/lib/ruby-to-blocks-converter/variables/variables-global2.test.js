import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    rubyToExpected,
    expectedInfo
} from '../../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/Variables', () => {
    let converter;
    let target;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null, {version: '2'});
        target = null;
    });

    describe('$a', () => {
        const varName = '$a';

        // list() syntax tests removed: list() is only available in v1.
        // Array syntax equivalents are tested in variables-array-global.test.js.

        test('data_showlist', async () => {
            const code = `show_list("${varName}")`;
            const expected = [
                {
                    opcode: 'data_showlist',
                    fields: [
                        {
                            name: 'LIST',
                            list: varName
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_hidelist', async () => {
            const code = `hide_list("${varName}")`;
            const expected = [
                {
                    opcode: 'data_hidelist',
                    fields: [
                        {
                            name: 'LIST',
                            list: varName
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });
    });
});
