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
        converter = new RubyToBlocksConverter(null, {version: '2'});
        target = null;
    });

    describe('@a', () => {
        const varName = '@a';

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

        // === Smalruby: Start of array syntax ===
        // In version 2, @a.length and @a[0] are list operations (array syntax)
        test('data_lengthoflist via length', async () => {
            const code = `${varName}.length`;
            const expected = [
                {
                    opcode: 'data_lengthoflist',
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

        test('data_itemoflist via [] with 0-indexed', async () => {
            const code = `${varName}[0]`;
            const expected = [
                {
                    opcode: 'data_itemoflist',
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
        // === Smalruby: End of array syntax ===

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

        // list() syntax tests removed: list() is only available in v1.
        // Array syntax equivalents are tested in variables-array-global.test.js.
    });
});
