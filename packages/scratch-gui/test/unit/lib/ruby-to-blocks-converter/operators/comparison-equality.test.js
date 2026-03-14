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

    test('operator_gt', async () => {
        code = '1 > 50';
        expected = [
            {
                opcode: 'operator_gt',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: expectedInfo.makeText('1')
                    },
                    {
                        name: 'OPERAND2',
                        block: expectedInfo.makeText('50')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '1 > (50)';
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'x > y';
        expected = [
            {
                opcode: 'operator_gt',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeText('')
                    },
                    {
                        name: 'OPERAND2',
                        block: (await rubyToExpected(converter, target, 'y'))[0],
                        shadow: expectedInfo.makeText('50')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '$global > y';
        expected = [
            {
                opcode: 'operator_gt',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: (await rubyToExpected(converter, target, '$global'))[0],
                        shadow: expectedInfo.makeText('')
                    },
                    {
                        name: 'OPERAND2',
                        block: (await rubyToExpected(converter, target, 'y'))[0],
                        shadow: expectedInfo.makeText('50')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('operator_lt', async () => {
        code = '1 < 50';
        expected = [
            {
                opcode: 'operator_lt',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: expectedInfo.makeText('1')
                    },
                    {
                        name: 'OPERAND2',
                        block: expectedInfo.makeText('50')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '1 < (50)';
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'x < y';
        expected = [
            {
                opcode: 'operator_lt',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeText('')
                    },
                    {
                        name: 'OPERAND2',
                        block: (await rubyToExpected(converter, target, 'y'))[0],
                        shadow: expectedInfo.makeText('50')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '$global < y';
        expected = [
            {
                opcode: 'operator_lt',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: (await rubyToExpected(converter, target, '$global'))[0],
                        shadow: expectedInfo.makeText('')
                    },
                    {
                        name: 'OPERAND2',
                        block: (await rubyToExpected(converter, target, 'y'))[0],
                        shadow: expectedInfo.makeText('50')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('operator_equals', async () => {
        code = '1 == 50';
        expected = [
            {
                opcode: 'operator_equals',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: expectedInfo.makeText('1')
                    },
                    {
                        name: 'OPERAND2',
                        block: expectedInfo.makeText('50')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '1 == (50)';
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'x == y';
        expected = [
            {
                opcode: 'operator_equals',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeText('')
                    },
                    {
                        name: 'OPERAND2',
                        block: (await rubyToExpected(converter, target, 'y'))[0],
                        shadow: expectedInfo.makeText('50')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '$global == 21';
        expected = [
            {
                opcode: 'operator_equals',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: (await rubyToExpected(converter, target, '$global'))[0],
                        shadow: expectedInfo.makeText('')
                    },
                    {
                        name: 'OPERAND2',
                        block: expectedInfo.makeText('21')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });
});
