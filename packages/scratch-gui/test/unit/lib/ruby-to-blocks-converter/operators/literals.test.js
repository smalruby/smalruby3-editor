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

    test('ruby_literal_true', async () => {
        code = 'true';
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
                        block: expectedInfo.makeText('1')
                    }
                ],
                comment: {
                    text: '@ruby:literal:true:1',
                    minimized: true
                }
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'true\ntrue';
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
                        block: expectedInfo.makeText('1')
                    }
                ],
                comment: {
                    text: '@ruby:literal:true:1',
                    minimized: true
                }
            },
            {
                opcode: 'operator_equals',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: expectedInfo.makeText('1')
                    },
                    {
                        name: 'OPERAND2',
                        block: expectedInfo.makeText('1')
                    }
                ],
                comment: {
                    text: '@ruby:literal:true:2',
                    minimized: true
                }
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('ruby_literal_false', async () => {
        code = 'false';
        expected = [
            {
                opcode: 'operator_lt',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: expectedInfo.makeText('0')
                    },
                    {
                        name: 'OPERAND2',
                        block: expectedInfo.makeText('0')
                    }
                ],
                comment: {
                    text: '@ruby:literal:false:1',
                    minimized: true
                }
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'false\nfalse';
        expected = [
            {
                opcode: 'operator_lt',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: expectedInfo.makeText('0')
                    },
                    {
                        name: 'OPERAND2',
                        block: expectedInfo.makeText('0')
                    }
                ],
                comment: {
                    text: '@ruby:literal:false:1',
                    minimized: true
                }
            },
            {
                opcode: 'operator_lt',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: expectedInfo.makeText('0')
                    },
                    {
                        name: 'OPERAND2',
                        block: expectedInfo.makeText('0')
                    }
                ],
                comment: {
                    text: '@ruby:literal:false:2',
                    minimized: true
                }
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('ruby_literal_true_false_assignment', async () => {
        code = 'x = true';
        expected = await rubyToExpected(converter, target, 'x = 0');
        const valueInput1 = expected[0].inputs.find(i => i.name === 'X');
        valueInput1.block = {
            opcode: 'operator_equals',
            inputs: [
                {
                    name: 'OPERAND1',
                    block: expectedInfo.makeText('1')
                },
                {
                    name: 'OPERAND2',
                    block: expectedInfo.makeText('1')
                }
            ],
            comment: {
                text: '@ruby:literal:true:1',
                minimized: true
            }
        };
        valueInput1.shadow = expectedInfo.makeNumber('0');
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'x = false';
        expected = await rubyToExpected(converter, target, 'x = 0');
        const valueInput2 = expected[0].inputs.find(i => i.name === 'X');
        valueInput2.block = {
            opcode: 'operator_lt',
            inputs: [
                {
                    name: 'OPERAND1',
                    block: expectedInfo.makeText('0')
                },
                {
                    name: 'OPERAND2',
                    block: expectedInfo.makeText('0')
                }
            ],
            comment: {
                text: '@ruby:literal:false:1',
                minimized: true
            }
        };
        valueInput2.shadow = expectedInfo.makeNumber('0');
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('ruby_literal_true_false_if', async () => {
        code = 'if true\n  move(10)\nend';
        expected = await rubyToExpected(converter, target, 'if x == 1\n  move(10)\nend');
        expected[0].inputs.find(i => i.name === 'CONDITION').block = {
            opcode: 'operator_equals',
            inputs: [
                {
                    name: 'OPERAND1',
                    block: expectedInfo.makeText('1')
                },
                {
                    name: 'OPERAND2',
                    block: expectedInfo.makeText('1')
                }
            ],
            comment: {
                text: '@ruby:literal:true:1',
                minimized: true
            }
        };
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });
});
