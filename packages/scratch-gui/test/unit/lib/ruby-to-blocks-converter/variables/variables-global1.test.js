import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    rubyToExpected,
    expectedInfo
} from '../../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/Variables', () => {
    let converter;
    let target;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null);
        target = null;
    });

    describe('$a', () => {
        const varName = '$a';

        test('data_variable', async () => {
            const code = varName;
            const expected = [
                {
                    opcode: 'data_variable',
                    fields: [
                        {
                            name: 'VARIABLE',
                            variable: varName
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('operator_length', async () => {
            const code = `${varName}.length`;
            const expected = [
                {
                    opcode: 'operator_length',
                    inputs: [
                        {
                            name: 'STRING',
                            block: (await rubyToExpected(converter, target, varName))[0],
                            shadow: expectedInfo.makeText('apple')
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('operator_letter_of', async () => {
            const code = `${varName}[0]`;
            const expected = [
                {
                    opcode: 'operator_letter_of',
                    inputs: [
                        {
                            name: 'STRING',
                            block: (await rubyToExpected(converter, target, varName))[0],
                            shadow: expectedInfo.makeText('apple')
                        },
                        {
                            name: 'LETTER',
                            block: expectedInfo.makeNumber(1)
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_setvariableto', async () => {
            const code = `${varName} = "world"`;
            const expected = [
                {
                    opcode: 'data_setvariableto',
                    fields: [
                        {
                            name: 'VARIABLE',
                            variable: varName
                        }
                    ],
                    inputs: [
                        {
                            name: 'VALUE',
                            block: expectedInfo.makeText('world')
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_changevariableby', async () => {
            const code = `${varName} += 1`;
            const expected = [
                {
                    opcode: 'data_changevariableby',
                    fields: [
                        {
                            name: 'VARIABLE',
                            variable: varName
                        }
                    ],
                    inputs: [
                        {
                            name: 'VALUE',
                            block: expectedInfo.makeNumber(1)
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('compound assignment -= (data_setvariableto + operator_subtract)', async () => {
            const code = `${varName} -= 1`;
            const expected = [
                {
                    opcode: 'data_setvariableto',
                    fields: [
                        {
                            name: 'VARIABLE',
                            variable: varName
                        }
                    ],
                    inputs: [
                        {
                            name: 'VALUE',
                            block: {
                                opcode: 'operator_subtract',
                                inputs: [
                                    {
                                        name: 'NUM1',
                                        block: {
                                            opcode: 'data_variable',
                                            fields: [
                                                {
                                                    name: 'VARIABLE',
                                                    variable: varName
                                                }
                                            ]
                                        }
                                    },
                                    {
                                        name: 'NUM2',
                                        block: expectedInfo.makeNumber(1)
                                    }
                                ]
                            }
                        }
                    ],
                    comment: {text: '@ruby:syntax:-=', minimized: true}
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('compound assignment *= (data_setvariableto + operator_multiply)', async () => {
            const code = `${varName} *= 2`;
            const expected = [
                {
                    opcode: 'data_setvariableto',
                    fields: [
                        {
                            name: 'VARIABLE',
                            variable: varName
                        }
                    ],
                    inputs: [
                        {
                            name: 'VALUE',
                            block: {
                                opcode: 'operator_multiply',
                                inputs: [
                                    {
                                        name: 'NUM1',
                                        block: {
                                            opcode: 'data_variable',
                                            fields: [
                                                {
                                                    name: 'VARIABLE',
                                                    variable: varName
                                                }
                                            ]
                                        }
                                    },
                                    {
                                        name: 'NUM2',
                                        block: expectedInfo.makeNumber(2)
                                    }
                                ]
                            }
                        }
                    ],
                    comment: {text: '@ruby:syntax:*=', minimized: true}
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('compound assignment /= (data_setvariableto + operator_divide)', async () => {
            const code = `${varName} /= 2`;
            const expected = [
                {
                    opcode: 'data_setvariableto',
                    fields: [
                        {
                            name: 'VARIABLE',
                            variable: varName
                        }
                    ],
                    inputs: [
                        {
                            name: 'VALUE',
                            block: {
                                opcode: 'operator_divide',
                                inputs: [
                                    {
                                        name: 'NUM1',
                                        block: {
                                            opcode: 'data_variable',
                                            fields: [
                                                {
                                                    name: 'VARIABLE',
                                                    variable: varName
                                                }
                                            ]
                                        }
                                    },
                                    {
                                        name: 'NUM2',
                                        block: expectedInfo.makeNumber(2)
                                    }
                                ]
                            }
                        }
                    ],
                    comment: {text: '@ruby:syntax:/=', minimized: true}
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('compound assignment %= (data_setvariableto + operator_mod)', async () => {
            const code = `${varName} %= 3`;
            const expected = [
                {
                    opcode: 'data_setvariableto',
                    fields: [
                        {
                            name: 'VARIABLE',
                            variable: varName
                        }
                    ],
                    inputs: [
                        {
                            name: 'VALUE',
                            block: {
                                opcode: 'operator_mod',
                                inputs: [
                                    {
                                        name: 'NUM1',
                                        block: {
                                            opcode: 'data_variable',
                                            fields: [
                                                {
                                                    name: 'VARIABLE',
                                                    variable: varName
                                                }
                                            ]
                                        }
                                    },
                                    {
                                        name: 'NUM2',
                                        block: expectedInfo.makeNumber(3)
                                    }
                                ]
                            }
                        }
                    ],
                    comment: {text: '@ruby:syntax:%=', minimized: true}
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_showvariable', async () => {
            const code = `show_variable("${varName}")`;
            const expected = [
                {
                    opcode: 'data_showvariable',
                    fields: [
                        {
                            name: 'VARIABLE',
                            variable: varName
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_hidevariable', async () => {
            const code = `hide_variable("${varName}")`;
            const expected = [
                {
                    opcode: 'data_hidevariable',
                    fields: [
                        {
                            name: 'VARIABLE',
                            variable: varName
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_listcontents', async () => {
            const code = `list("${varName}")`;
            const expected = [
                {
                    opcode: 'data_listcontents',
                    fields: [
                        {
                            name: 'LIST',
                            list: varName
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_addtolist', async () => {
            const code = `list("${varName}").push("thing")`;
            const expected = [
                {
                    opcode: 'data_addtolist',
                    fields: [
                        {
                            name: 'LIST',
                            list: varName
                        }
                    ],
                    inputs: [
                        {
                            name: 'ITEM',
                            block: expectedInfo.makeText('thing')
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_deleteoflist', async () => {
            const code = `list("${varName}").delete_at(1)`;
            const expected = [
                {
                    opcode: 'data_deleteoflist',
                    fields: [
                        {
                            name: 'LIST',
                            list: varName
                        }
                    ],
                    inputs: [
                        {
                            name: 'INDEX',
                            block: expectedInfo.makeNumber(1, 'math_integer')
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });
    });
});
