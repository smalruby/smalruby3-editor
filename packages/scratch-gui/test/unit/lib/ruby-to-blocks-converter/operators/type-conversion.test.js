import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    convertAndExpectRubyBlockError,
    rubyToExpected,
    expectedInfo
} from '../../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/Operators', () => {
    let converter;
    let target;
    let code;
    let expected;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null, {version: '2'});
        target = null;
        code = null;
        expected = null;
    });

    test('to_s', async () => {
        code = 'x.to_s';
        expected = [
            {
                opcode: 'operator_join',
                inputs: [
                    {
                        name: 'STRING1',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeText('')
                    },
                    {
                        name: 'STRING2',
                        block: expectedInfo.makeText(''),
                        shadow: expectedInfo.makeText('')
                    }
                ],
                comment: {
                    text: '@ruby:method:to_s',
                    minimized: true
                }
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '123.to_s';
        expected = [
            {
                opcode: 'operator_join',
                inputs: [
                    {
                        name: 'STRING1',
                        block: expectedInfo.makeNumber(123)
                    },
                    {
                        name: 'STRING2',
                        block: expectedInfo.makeText(''),
                        shadow: expectedInfo.makeText('')
                    }
                ],
                comment: {
                    text: '@ruby:method:to_s',
                    minimized: true
                }
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('to_i', async () => {
        code = 'x.to_i';
        expected = [
            {
                opcode: 'operator_add',
                inputs: [
                    {
                        name: 'NUM1',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeNumber('')
                    },
                    {
                        name: 'NUM2',
                        block: expectedInfo.makeNumber(0),
                        shadow: expectedInfo.makeNumber(0)
                    }
                ],
                comment: {
                    text: '@ruby:method:to_i',
                    minimized: true
                }
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '"123".to_i';
        expected = [
            {
                opcode: 'operator_add',
                inputs: [
                    {
                        name: 'NUM1',
                        block: expectedInfo.makeText('123')
                    },
                    {
                        name: 'NUM2',
                        block: expectedInfo.makeNumber(0),
                        shadow: expectedInfo.makeNumber(0)
                    }
                ],
                comment: {
                    text: '@ruby:method:to_i',
                    minimized: true
                }
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('reject non-boolean blocks in boolean inputs', async () => {
        { for (const s of [
            '!move(10)',
            'move(10) && touching?("_edge_")',
            'touching?("_edge_") && move(10)',
            'move(10) || touching?("_edge_")',
            'touching?("_edge_") || move(10)'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });
});
