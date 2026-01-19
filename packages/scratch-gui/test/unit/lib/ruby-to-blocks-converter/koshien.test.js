import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    convertAndExpectRubyBlockError,
    rubyToExpected,
    expectedInfo
} from '../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/Koshien', () => {
    let converter;
    let target;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null);
        target = null;
    });

    test('koshien_setMessage', () => {
        let code;
        let expected;

        code = 'koshien.set_message("hello")';
        expected = [
            {
                opcode: 'koshien_setMessage',
                inputs: [
                    {
                        name: 'MESSAGE',
                        block: expectedInfo.makeText('hello')
                    }
                ]
            }
        ];
        convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'koshien.set_message(x)';
        expected = [
            {
                opcode: 'koshien_setMessage',
                inputs: [
                    {
                        name: 'MESSAGE',
                        block: rubyToExpected(converter, target, 'x')[0],
                        shadow: expectedInfo.makeText('hello')
                    }
                ]
            }
        ];
        convertAndExpectToEqualBlocks(converter, target, code, expected);

        [
            'koshien.set_message()',
            'koshien.set_message("hello", "world")'
        ].forEach(s => {
            convertAndExpectRubyBlockError(converter, target, s);
        });
    });
});
