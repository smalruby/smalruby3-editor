// === Smalruby: This file is Smalruby-specific (Ruby array syntax for Scratch lists) ===
import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    expectedInfo
} from '../../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/Variables/ArraySyntax', () => {
    let converter;
    let target;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null, {version: '2'});
        target = null;
    });

    describe('$a - global list with array syntax', () => {
        const varName = '$a';

        test('data_addtolist via push', async () => {
            const code = `${varName}.push("thing")`;
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

        test('data_addtolist via << operator', async () => {
            const code = `${varName} << "thing"`;
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

        test('data_deleteoflist with 0-indexed', async () => {
            const code = `${varName}.delete_at(0)`;
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

        test('data_deletealloflist via clear', async () => {
            const code = `${varName}.clear`;
            const expected = [
                {
                    opcode: 'data_deletealloflist',
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

        test('data_insertatlist with 0-indexed', async () => {
            const code = `${varName}.insert(0, "thing")`;
            const expected = [
                {
                    opcode: 'data_insertatlist',
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
                        },
                        {
                            name: 'ITEM',
                            block: expectedInfo.makeText('thing')
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_replaceitemoflist with 0-indexed', async () => {
            const code = `${varName}[0] = "thing"`;
            const expected = [
                {
                    opcode: 'data_replaceitemoflist',
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
                        },
                        {
                            name: 'ITEM',
                            block: expectedInfo.makeText('thing')
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_itemoflist with 0-indexed', async () => {
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

        test('data_itemnumoflist via index', async () => {
            const code = `${varName}.index("thing")`;
            const expected = [
                {
                    opcode: 'data_itemnumoflist',
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

        test('data_listcontainsitem via include?', async () => {
            const code = `${varName}.include?("thing")`;
            const expected = [
                {
                    opcode: 'data_listcontainsitem',
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

        test('array literal $a = [1, 2, 3] generates clear + push blocks', async () => {
            const code = `${varName} = [1, 2, 3]`;
            const expected = [
                {
                    opcode: 'data_deletealloflist',
                    fields: [
                        {
                            name: 'LIST',
                            list: varName
                        }
                    ],
                    comment: {text: '@ruby:array:literal:3', minimized: true},
                    next: {
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
                                block: expectedInfo.makeText('1')
                            }
                        ],
                        comment: {text: '@ruby:array:literal:element', minimized: true},
                        next: {
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
                                    block: expectedInfo.makeText('2')
                                }
                            ],
                            comment: {text: '@ruby:array:literal:element', minimized: true},
                            next: {
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
                                        block: expectedInfo.makeText('3')
                                    }
                                ],
                                comment: {text: '@ruby:array:literal:element', minimized: true}
                            }
                        }
                    }
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('empty array literal $a = [] generates clear only', async () => {
            const code = `${varName} = []`;
            const expected = [
                {
                    opcode: 'data_deletealloflist',
                    fields: [
                        {
                            name: 'LIST',
                            list: varName
                        }
                    ],
                    comment: {text: '@ruby:array:literal:0', minimized: true}
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });
    });
});
