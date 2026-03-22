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

    describe('String#delete (REPORTER)', () => {
        test('should convert string literal receiver with string arg', async () => {
            const code = '"hello world".delete("l")';
            const expected = [
                {
                    opcode: 'smalrubyRuby_stringMethodR',
                    fields: [
                        {
                            name: 'METHOD',
                            value: 'delete'
                        }
                    ],
                    inputs: [
                        {
                            name: 'STRING',
                            block: expectedInfo.makeText('hello world')
                        },
                        {
                            name: 'ARG1',
                            block: expectedInfo.makeText('l')
                        }
                    ],
                    mutation: {
                        blockInfo: expect.any(String)
                    }
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('should reject wrong number of arguments', async () => {
            await convertAndExpectRubyBlockError(converter, target, '"hello".delete()');
            await convertAndExpectRubyBlockError(converter, target, '"hello".delete("l", "o")');
        });
    });

    describe('String#delete! (COMMAND)', () => {
        test('should convert string literal receiver with string arg', async () => {
            const code = '"hello world".delete!("l")';
            const expected = [
                {
                    opcode: 'smalrubyRuby_stringMethodC',
                    fields: [
                        {
                            name: 'METHOD',
                            value: 'delete!'
                        }
                    ],
                    inputs: [
                        {
                            name: 'STRING',
                            block: expectedInfo.makeText('hello world')
                        },
                        {
                            name: 'ARG1',
                            block: expectedInfo.makeText('l')
                        }
                    ],
                    mutation: {
                        blockInfo: expect.any(String)
                    }
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('should reject wrong number of arguments', async () => {
            await convertAndExpectRubyBlockError(converter, target, '"hello".delete!()');
            await convertAndExpectRubyBlockError(converter, target, '"hello".delete!("l", "o")');
        });
    });
});
