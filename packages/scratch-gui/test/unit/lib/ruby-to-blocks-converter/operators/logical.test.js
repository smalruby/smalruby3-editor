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

    test('operator_and', async () => {
        code = '1 < x && x < 10';
        expected = [
            {
                opcode: 'operator_and',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: (await rubyToExpected(converter, target, '1 < x'))[0]
                    },
                    {
                        name: 'OPERAND2',
                        block: (await rubyToExpected(converter, target, 'x < 10'))[0]
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '1 < x && (x < 10)';
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '1 < $global && $global < 10';
        expected = [
            {
                opcode: 'operator_and',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: (await rubyToExpected(converter, target, '1 < $global'))[0]
                    },
                    {
                        name: 'OPERAND2',
                        block: (await rubyToExpected(converter, target, '$global < 10'))[0]
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'false && false';
        expected = [
            {
                opcode: 'operator_and',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: {
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
                    },
                    {
                        name: 'OPERAND2',
                        block: {
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
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('operator_or', async () => {
        code = 'x == 2 || y == 3';
        expected = [
            {
                opcode: 'operator_or',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: (await rubyToExpected(converter, target, 'x == 2'))[0]
                    },
                    {
                        name: 'OPERAND2',
                        block: (await rubyToExpected(converter, target, 'y == 3'))[0]
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'x == 2 || (y == 3)';
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '$global == 2 || $global == 3';
        expected = [
            {
                opcode: 'operator_or',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: (await rubyToExpected(converter, target, '$global == 2'))[0]
                    },
                    {
                        name: 'OPERAND2',
                        block: (await rubyToExpected(converter, target, '$global == 3'))[0]
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'false || false';
        expected = [
            {
                opcode: 'operator_or',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: {
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
                    },
                    {
                        name: 'OPERAND2',
                        block: {
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
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('operator_not', async () => {
        code = '!touching?("_edge_")';
        expected = [
            {
                opcode: 'operator_not',
                inputs: [
                    {
                        name: 'OPERAND',
                        block: (await rubyToExpected(converter, target, 'touching?("_edge_")'))[0]
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '!($global == 1)';
        expected = [
            {
                opcode: 'operator_not',
                inputs: [
                    {
                        name: 'OPERAND',
                        block: (await rubyToExpected(converter, target, '$global == 1'))[0]
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '!$global';
        expected = [
            {
                opcode: 'operator_not',
                inputs: [
                    {
                        name: 'OPERAND',
                        block: (await rubyToExpected(converter, target, '$global'))[0]
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '!@ivar';
        expected = [
            {
                opcode: 'operator_not',
                inputs: [
                    {
                        name: 'OPERAND',
                        block: (await rubyToExpected(converter, target, '@ivar'))[0]
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '!false';
        expected = [
            {
                opcode: 'operator_not',
                inputs: [
                    {
                        name: 'OPERAND',
                        block: {
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
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });
});
