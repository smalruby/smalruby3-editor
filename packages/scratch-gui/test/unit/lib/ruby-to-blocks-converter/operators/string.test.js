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

    test('operator_join', async () => {
        code = '"apple" + "banana"';
        expected = [
            {
                opcode: 'operator_join',
                inputs: [
                    {
                        name: 'STRING1',
                        block: expectedInfo.makeText('apple')
                    },
                    {
                        name: 'STRING2',
                        block: expectedInfo.makeText('banana')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '"apple" + x';
        expected = [
            {
                opcode: 'operator_join',
                inputs: [
                    {
                        name: 'STRING1',
                        block: expectedInfo.makeText('apple')
                    },
                    {
                        name: 'STRING2',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeText('banana')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'x + "banana"';
        expected = [
            {
                opcode: 'operator_join',
                inputs: [
                    {
                        name: 'STRING1',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeText('apple')
                    },
                    {
                        name: 'STRING2',
                        block: expectedInfo.makeText('banana')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('operator_letter_of', async () => {
        code = '"apple"[0]';
        expected = [
            {
                opcode: 'operator_letter_of',
                inputs: [
                    {
                        name: 'STRING',
                        block: expectedInfo.makeText('apple')
                    },
                    {
                        name: 'LETTER',
                        block: expectedInfo.makeNumber(1)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'x[y]';
        expected = [
            {
                opcode: 'operator_letter_of',
                inputs: [
                    {
                        name: 'STRING',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeText('apple')
                    },
                    {
                        name: 'LETTER',
                        block: (await rubyToExpected(converter, target, 'y'))[0],
                        shadow: expectedInfo.makeNumber(1)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('operator_length', async () => {
        code = '"apple".length';
        expected = [
            {
                opcode: 'operator_length',
                inputs: [
                    {
                        name: 'STRING',
                        block: expectedInfo.makeText('apple')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'x.length';
        expected = [
            {
                opcode: 'operator_length',
                inputs: [
                    {
                        name: 'STRING',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeText('apple')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('empty?', async () => {
        code = '"apple".empty?';
        expected = [
            {
                opcode: 'operator_equals',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: {
                            opcode: 'operator_length',
                            inputs: [
                                {
                                    name: 'STRING',
                                    block: expectedInfo.makeText('apple')
                                }
                            ],
                            comment: {
                                text: '@ruby:method:empty?:1',
                                minimized: true
                            }
                        },
                        shadow: expectedInfo.makeText('')
                    },
                    {
                        name: 'OPERAND2',
                        block: expectedInfo.makeText('0')
                    }
                ],
                comment: {
                    text: '@ruby:method:empty?:1',
                    minimized: true
                }
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'x.empty?';
        expected = [
            {
                opcode: 'operator_equals',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: {
                            opcode: 'operator_length',
                            inputs: [
                                {
                                    name: 'STRING',
                                    block: (await rubyToExpected(converter, target, 'x'))[0],
                                    shadow: expectedInfo.makeText('apple')
                                }
                            ],
                            comment: {
                                text: '@ruby:method:empty?:1',
                                minimized: true
                            }
                        },
                        shadow: expectedInfo.makeText('')
                    },
                    {
                        name: 'OPERAND2',
                        block: expectedInfo.makeText('0')
                    }
                ],
                comment: {
                    text: '@ruby:method:empty?:1',
                    minimized: true
                }
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'list("@list").empty?';
        expected = [
            {
                opcode: 'operator_equals',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: {
                            opcode: 'data_lengthoflist',
                            fields: [
                                {
                                    name: 'LIST',
                                    list: '@list'
                                }
                            ],
                            comment: {
                                text: '@ruby:method:empty?:1',
                                minimized: true
                            }
                        },
                        shadow: expectedInfo.makeText('')
                    },
                    {
                        name: 'OPERAND2',
                        block: expectedInfo.makeText('0')
                    }
                ],
                comment: {
                    text: '@ruby:method:empty?:1',
                    minimized: true
                }
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('operator_contains', async () => {
        code = '"apple".include?("a")';
        expected = [
            {
                opcode: 'operator_contains',
                inputs: [
                    {
                        name: 'STRING1',
                        block: expectedInfo.makeText('apple')
                    },
                    {
                        name: 'STRING2',
                        block: expectedInfo.makeText('a')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'x.include?(y)';
        expected = [
            {
                opcode: 'operator_contains',
                inputs: [
                    {
                        name: 'STRING1',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeText('apple')
                    },
                    {
                        name: 'STRING2',
                        block: (await rubyToExpected(converter, target, 'y'))[0],
                        shadow: expectedInfo.makeText('a')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });
});
