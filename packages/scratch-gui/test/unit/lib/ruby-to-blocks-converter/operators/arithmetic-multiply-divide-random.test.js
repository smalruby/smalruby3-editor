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

    test('operator_multiply', async () => {
        code = '1 * 2';
        expected = [
            {
                opcode: 'operator_multiply',
                inputs: [
                    {
                        name: 'NUM1',
                        block: expectedInfo.makeNumber(1)
                    },
                    {
                        name: 'NUM2',
                        block: expectedInfo.makeNumber(2)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '1 * (2)';
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'x * y';
        expected = [
            {
                opcode: 'operator_multiply',
                inputs: [
                    {
                        name: 'NUM1',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeNumber('')
                    },
                    {
                        name: 'NUM2',
                        block: (await rubyToExpected(converter, target, 'y'))[0],
                        shadow: expectedInfo.makeNumber('')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '$global * y';
        expected = [
            {
                opcode: 'operator_multiply',
                inputs: [
                    {
                        name: 'NUM1',
                        block: (await rubyToExpected(converter, target, '$global'))[0],
                        shadow: expectedInfo.makeNumber('')
                    },
                    {
                        name: 'NUM2',
                        block: (await rubyToExpected(converter, target, 'y'))[0],
                        shadow: expectedInfo.makeNumber('')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        // "1" * 2 is now valid (String#*), "1" * "2" is also handled by String#*
        // Only numeric receiver with string arg remains an error
        { for (const s of [
            '1 * "2"'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });

    test('operator_divide', async () => {
        code = '2 / 1';
        expected = [
            {
                opcode: 'operator_divide',
                inputs: [
                    {
                        name: 'NUM1',
                        block: expectedInfo.makeNumber(2)
                    },
                    {
                        name: 'NUM2',
                        block: expectedInfo.makeNumber(1)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '2 / (1)';
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'x / y';
        expected = [
            {
                opcode: 'operator_divide',
                inputs: [
                    {
                        name: 'NUM1',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeNumber('')
                    },
                    {
                        name: 'NUM2',
                        block: (await rubyToExpected(converter, target, 'y'))[0],
                        shadow: expectedInfo.makeNumber('')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '$global / y';
        expected = [
            {
                opcode: 'operator_divide',
                inputs: [
                    {
                        name: 'NUM1',
                        block: (await rubyToExpected(converter, target, '$global'))[0],
                        shadow: expectedInfo.makeNumber('')
                    },
                    {
                        name: 'NUM2',
                        block: (await rubyToExpected(converter, target, 'y'))[0],
                        shadow: expectedInfo.makeNumber('')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        { for (const s of [
            '"2" / "1"',
            '2 / "1"',
            '"2" / 1'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });

    test('operator_random', async () => {
        code = 'rand(1..10)';
        expected = [
            {
                opcode: 'operator_random',
                inputs: [
                    {
                        name: 'FROM',
                        block: expectedInfo.makeNumber(1)
                    },
                    {
                        name: 'TO',
                        block: expectedInfo.makeNumber(10)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'rand(x..y)';
        expected = [
            {
                opcode: 'operator_random',
                inputs: [
                    {
                        name: 'FROM',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeNumber(1)
                    },
                    {
                        name: 'TO',
                        block: (await rubyToExpected(converter, target, 'y'))[0],
                        shadow: expectedInfo.makeNumber(10)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'rand($global..y)';
        expected = [
            {
                opcode: 'operator_random',
                inputs: [
                    {
                        name: 'FROM',
                        block: (await rubyToExpected(converter, target, '$global'))[0],
                        shadow: expectedInfo.makeNumber(1)
                    },
                    {
                        name: 'TO',
                        block: (await rubyToExpected(converter, target, 'y'))[0],
                        shadow: expectedInfo.makeNumber(10)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        { for (const s of [
            'random()',
            'random',
            'random(1)',
            'random(10)',
            'random(1..10, 23)',
            'random("1..10")'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });
});
