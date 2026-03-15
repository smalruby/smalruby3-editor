// === Smalruby: This file is Smalruby-specific (v1 list() syntax converter tests) ===
import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    expectedInfo
} from '../../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/Variables/ListV1', () => {
    let converter;
    let target;

    beforeEach(() => {
        // v1 converter (no version option = v1 default)
        converter = new RubyToBlocksConverter(null);
        target = null;
    });

    describe('list("$a") - v1 global list operations', () => {
        const listName = '$a';

        test('data_addtolist via push', async () => {
            const code = `list("${listName}").push("thing")`;
            const expected = [
                {
                    opcode: 'data_addtolist',
                    fields: [
                        {
                            name: 'LIST',
                            list: listName
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

        test('data_deleteoflist with 1-indexed (no adjustment)', async () => {
            const code = `list("${listName}").delete_at(1)`;
            const expected = [
                {
                    opcode: 'data_deleteoflist',
                    fields: [
                        {
                            name: 'LIST',
                            list: listName
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
            const code = `list("${listName}").clear`;
            const expected = [
                {
                    opcode: 'data_deletealloflist',
                    fields: [
                        {
                            name: 'LIST',
                            list: listName
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_insertatlist with 1-indexed (no adjustment)', async () => {
            const code = `list("${listName}").insert(1, "thing")`;
            const expected = [
                {
                    opcode: 'data_insertatlist',
                    fields: [
                        {
                            name: 'LIST',
                            list: listName
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

        test('data_replaceitemoflist with 1-indexed (no adjustment)', async () => {
            const code = `list("${listName}")[1] = "thing"`;
            const expected = [
                {
                    opcode: 'data_replaceitemoflist',
                    fields: [
                        {
                            name: 'LIST',
                            list: listName
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

        test('data_itemoflist with 1-indexed (no adjustment)', async () => {
            const code = `list("${listName}")[1]`;
            const expected = [
                {
                    opcode: 'data_itemoflist',
                    fields: [
                        {
                            name: 'LIST',
                            list: listName
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

        test('data_itemnumoflist via index (no subtract wrapper in v1)', async () => {
            const code = `list("${listName}").index("thing")`;
            const expected = [
                {
                    opcode: 'data_itemnumoflist',
                    fields: [
                        {
                            name: 'LIST',
                            list: listName
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
            const code = `list("${listName}").length`;
            const expected = [
                {
                    opcode: 'data_lengthoflist',
                    fields: [
                        {
                            name: 'LIST',
                            list: listName
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_listcontainsitem via include?', async () => {
            const code = `list("${listName}").include?("thing")`;
            const expected = [
                {
                    opcode: 'data_listcontainsitem',
                    fields: [
                        {
                            name: 'LIST',
                            list: listName
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
    });

    describe('list("@a") - v1 instance list operations', () => {
        const listName = '@a';

        test('data_itemoflist with 1-indexed (no adjustment)', async () => {
            const code = `list("${listName}")[1]`;
            const expected = [
                {
                    opcode: 'data_itemoflist',
                    fields: [
                        {
                            name: 'LIST',
                            list: listName
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

        test('data_deleteoflist with 1-indexed (no adjustment)', async () => {
            const code = `list("${listName}").delete_at(1)`;
            const expected = [
                {
                    opcode: 'data_deleteoflist',
                    fields: [
                        {
                            name: 'LIST',
                            list: listName
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

    describe('v1 index with higher values', () => {
        const listName = '$a';

        test('data_itemoflist with index 3 (stored as-is)', async () => {
            const code = `list("${listName}")[3]`;
            const expected = [
                {
                    opcode: 'data_itemoflist',
                    fields: [
                        {
                            name: 'LIST',
                            list: listName
                        }
                    ],
                    inputs: [
                        {
                            name: 'INDEX',
                            block: expectedInfo.makeNumber(3, 'math_integer')
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_insertatlist with index 2 (stored as-is)', async () => {
            const code = `list("${listName}").insert(2, "thing")`;
            const expected = [
                {
                    opcode: 'data_insertatlist',
                    fields: [
                        {
                            name: 'LIST',
                            list: listName
                        }
                    ],
                    inputs: [
                        {
                            name: 'INDEX',
                            block: expectedInfo.makeNumber(2, 'math_integer')
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
    });
});
