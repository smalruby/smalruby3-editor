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
        converter = new RubyToBlocksConverter(null);
        target = null;
        code = null;
        expected = null;
    });

    test('operator_not_equals', async () => {
        code = '1 != 50';
        expected = [
            {
                opcode: 'operator_not',
                inputs: [
                    {
                        name: 'OPERAND',
                        block: {
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
                            ],
                            comment: {
                                text: '@ruby:operator:!=:1',
                                minimized: true
                            }
                        }
                    }
                ],
                comment: {
                    text: '@ruby:operator:!=:1',
                    minimized: true
                }
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'x != y';
        expected = [
            {
                opcode: 'operator_not',
                inputs: [
                    {
                        name: 'OPERAND',
                        block: {
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
                            ],
                            comment: {
                                text: '@ruby:operator:!=:1',
                                minimized: true
                            }
                        }
                    }
                ],
                comment: {
                    text: '@ruby:operator:!=:1',
                    minimized: true
                }
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '1 != 50\n2 != 60';
        expected = [
            {
                opcode: 'operator_not',
                inputs: [
                    {
                        name: 'OPERAND',
                        block: {
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
                            ],
                            comment: {
                                text: '@ruby:operator:!=:1',
                                minimized: true
                            }
                        }
                    }
                ],
                comment: {
                    text: '@ruby:operator:!=:1',
                    minimized: true
                }
            },
            {
                opcode: 'operator_not',
                inputs: [
                    {
                        name: 'OPERAND',
                        block: {
                            opcode: 'operator_equals',
                            inputs: [
                                {
                                    name: 'OPERAND1',
                                    block: expectedInfo.makeText('2')
                                },
                                {
                                    name: 'OPERAND2',
                                    block: expectedInfo.makeText('60')
                                }
                            ],
                            comment: {
                                text: '@ruby:operator:!=:1',
                                minimized: true
                            }
                        }
                    }
                ],
                comment: {
                    text: '@ruby:operator:!=:1',
                    minimized: true
                }
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '1 != 50 && 2 != 60';
        expected = [
            {
                opcode: 'operator_and',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: {
                            opcode: 'operator_not',
                            inputs: [
                                {
                                    name: 'OPERAND',
                                    block: {
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
                                        ],
                                        comment: {
                                            text: '@ruby:operator:!=:1',
                                            minimized: true
                                        }
                                    }
                                }
                            ],
                            comment: {
                                text: '@ruby:operator:!=:1',
                                minimized: true
                            }
                        }
                    },
                    {
                        name: 'OPERAND2',
                        block: {
                            opcode: 'operator_not',
                            inputs: [
                                {
                                    name: 'OPERAND',
                                    block: {
                                        opcode: 'operator_equals',
                                        inputs: [
                                            {
                                                name: 'OPERAND1',
                                                block: expectedInfo.makeText('2')
                                            },
                                            {
                                                name: 'OPERAND2',
                                                block: expectedInfo.makeText('60')
                                            }
                                        ],
                                        comment: {
                                            text: '@ruby:operator:!=:2',
                                            minimized: true
                                        }
                                    }
                                }
                            ],
                            comment: {
                                text: '@ruby:operator:!=:2',
                                minimized: true
                            }
                        }
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });
});
