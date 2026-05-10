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
        // `.to_i` now maps to operator_mathop(floor) so the runtime actually
        // truncates. The `@ruby:method:to_i` marker preserves the source
        // method name on round-trip; legacy operator_add(x, 0) projects with
        // the same marker still emit `.to_i` via the generator's compat path.
        code = 'x.to_i';
        expected = [
            {
                opcode: 'operator_mathop',
                fields: [{name: 'OPERATOR', value: 'floor'}],
                inputs: [
                    {
                        name: 'NUM',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeNumber('')
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
                opcode: 'operator_mathop',
                fields: [{name: 'OPERATOR', value: 'floor'}],
                inputs: [
                    {
                        name: 'NUM',
                        block: expectedInfo.makeText('123')
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
