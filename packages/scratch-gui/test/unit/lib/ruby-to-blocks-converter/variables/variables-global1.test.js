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
                            block: (await rubyToExpected(converter, target, varName))[0]
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
                            block: (await rubyToExpected(converter, target, varName))[0]
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

        test('data_showvariable', async () => {
            const code = `show_variable("${varName.slice(1)}")`;
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
            const code = `hide_variable("${varName.slice(1)}")`;
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
            const code = `list("${varName.slice(1)}")`;
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
            const code = `list("${varName.slice(1)}").push("thing")`;
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
            const code = `list("${varName.slice(1)}").delete_at(1)`;
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
