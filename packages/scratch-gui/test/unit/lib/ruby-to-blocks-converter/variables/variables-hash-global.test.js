// === Smalruby: This file is Smalruby-specific (Ruby hash syntax for Scratch lists) ===
import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    expectedInfo
} from '../../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/Variables/HashSyntax', () => {
    let converter;
    let target;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null, {version: '2'});
        target = null;
    });

    describe('$a - global hash with symbol keys', () => {
        const varName = '$a';

        test('hash literal $a = {name: "Alice", age: 30} generates clear + push blocks', async () => {
            const code = `${varName} = {name: "Alice", age: 30}`;
            const expected = [
                {
                    opcode: 'data_deletealloflist',
                    fields: [
                        {
                            name: 'LIST',
                            list: '$_hash_a_keys_'
                        }
                    ],
                    comment: {text: '@ruby:hash:literal:2', minimized: true},
                    next: {
                        opcode: 'data_deletealloflist',
                        fields: [
                            {
                                name: 'LIST',
                                list: '$_hash_a_values_'
                            }
                        ],
                        comment: {text: '@ruby:hash:literal:values', minimized: true},
                        next: {
                            opcode: 'data_addtolist',
                            fields: [
                                {
                                    name: 'LIST',
                                    list: '$_hash_a_keys_'
                                }
                            ],
                            inputs: [
                                {
                                    name: 'ITEM',
                                    block: expectedInfo.makeText(':name')
                                }
                            ],
                            comment: {text: '@ruby:hash:literal:key:sym', minimized: true},
                            next: {
                                opcode: 'data_addtolist',
                                fields: [
                                    {
                                        name: 'LIST',
                                        list: '$_hash_a_values_'
                                    }
                                ],
                                inputs: [
                                    {
                                        name: 'ITEM',
                                        block: expectedInfo.makeText('Alice')
                                    }
                                ],
                                comment: {text: '@ruby:hash:literal:value', minimized: true},
                                next: {
                                    opcode: 'data_addtolist',
                                    fields: [
                                        {
                                            name: 'LIST',
                                            list: '$_hash_a_keys_'
                                        }
                                    ],
                                    inputs: [
                                        {
                                            name: 'ITEM',
                                            block: expectedInfo.makeText(':age')
                                        }
                                    ],
                                    comment: {text: '@ruby:hash:literal:key:sym', minimized: true},
                                    next: {
                                        opcode: 'data_addtolist',
                                        fields: [
                                            {
                                                name: 'LIST',
                                                list: '$_hash_a_values_'
                                            }
                                        ],
                                        inputs: [
                                            {
                                                name: 'ITEM',
                                                block: expectedInfo.makeText('30')
                                            }
                                        ],
                                        comment: {text: '@ruby:hash:literal:value', minimized: true}
                                    }
                                }
                            }
                        }
                    }
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('empty hash literal $a = {} generates clear blocks only', async () => {
            const code = `${varName} = {}`;
            const expected = [
                {
                    opcode: 'data_deletealloflist',
                    fields: [
                        {
                            name: 'LIST',
                            list: '$_hash_a_keys_'
                        }
                    ],
                    comment: {text: '@ruby:hash:literal:0', minimized: true},
                    next: {
                        opcode: 'data_deletealloflist',
                        fields: [
                            {
                                name: 'LIST',
                                list: '$_hash_a_values_'
                            }
                        ],
                        comment: {text: '@ruby:hash:literal:values', minimized: true}
                    }
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('hash literal with string keys $a = {"foo" => "bar"}', async () => {
            const code = `${varName} = {"foo" => "bar"}`;
            const expected = [
                {
                    opcode: 'data_deletealloflist',
                    fields: [
                        {
                            name: 'LIST',
                            list: '$_hash_a_keys_'
                        }
                    ],
                    comment: {text: '@ruby:hash:literal:1', minimized: true},
                    next: {
                        opcode: 'data_deletealloflist',
                        fields: [
                            {
                                name: 'LIST',
                                list: '$_hash_a_values_'
                            }
                        ],
                        comment: {text: '@ruby:hash:literal:values', minimized: true},
                        next: {
                            opcode: 'data_addtolist',
                            fields: [
                                {
                                    name: 'LIST',
                                    list: '$_hash_a_keys_'
                                }
                            ],
                            inputs: [
                                {
                                    name: 'ITEM',
                                    block: expectedInfo.makeText('foo')
                                }
                            ],
                            comment: {text: '@ruby:hash:literal:key:str', minimized: true},
                            next: {
                                opcode: 'data_addtolist',
                                fields: [
                                    {
                                        name: 'LIST',
                                        list: '$_hash_a_values_'
                                    }
                                ],
                                inputs: [
                                    {
                                        name: 'ITEM',
                                        block: expectedInfo.makeText('bar')
                                    }
                                ],
                                comment: {text: '@ruby:hash:literal:value', minimized: true}
                            }
                        }
                    }
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('hash literal with hash rocket symbol key $a = {:name => "Alice"}', async () => {
            const code = `${varName} = {:name => "Alice"}`;
            const expected = [
                {
                    opcode: 'data_deletealloflist',
                    fields: [
                        {
                            name: 'LIST',
                            list: '$_hash_a_keys_'
                        }
                    ],
                    comment: {text: '@ruby:hash:literal:1', minimized: true},
                    next: {
                        opcode: 'data_deletealloflist',
                        fields: [
                            {
                                name: 'LIST',
                                list: '$_hash_a_values_'
                            }
                        ],
                        comment: {text: '@ruby:hash:literal:values', minimized: true},
                        next: {
                            opcode: 'data_addtolist',
                            fields: [
                                {
                                    name: 'LIST',
                                    list: '$_hash_a_keys_'
                                }
                            ],
                            inputs: [
                                {
                                    name: 'ITEM',
                                    block: expectedInfo.makeText(':name')
                                }
                            ],
                            comment: {text: '@ruby:hash:literal:key:sym', minimized: true},
                            next: {
                                opcode: 'data_addtolist',
                                fields: [
                                    {
                                        name: 'LIST',
                                        list: '$_hash_a_values_'
                                    }
                                ],
                                inputs: [
                                    {
                                        name: 'ITEM',
                                        block: expectedInfo.makeText('Alice')
                                    }
                                ],
                                comment: {text: '@ruby:hash:literal:value', minimized: true}
                            }
                        }
                    }
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });
    });

    describe('$a - hash read with symbol key', () => {
        test('$a[:name] generates data_itemoflist with data_itemnumoflist', async () => {
            const code = '$a = {name: "Alice"}\nsay($a[:name])';
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            const blockIds = Object.keys(converter.blocks);
            const blocks = blockIds.map(id => converter.blocks[id]);

            // Find data_itemoflist block (hash get)
            const itemBlock = blocks.find(b => b.opcode === 'data_itemoflist');
            expect(itemBlock).toBeTruthy();

            // Verify it has @ruby:hash:get:sym comment
            const itemComment = converter._context.comments[itemBlock.comment];
            expect(itemComment.text).toBe('@ruby:hash:get:sym');

            // Verify it references the values list
            expect(itemBlock.fields.LIST.value).toBe('_hash_a_values_');

            // Find data_itemnumoflist block (key lookup)
            const numBlock = blocks.find(b => b.opcode === 'data_itemnumoflist');
            expect(numBlock).toBeTruthy();
            // Verify it references the keys list
            expect(numBlock.fields.LIST.value).toBe('_hash_a_keys_');
        });

        test('$a["foo"] generates data_itemoflist with string key', async () => {
            const code = '$a = {"foo" => "bar"}\nsay($a["foo"])';
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            const blockIds = Object.keys(converter.blocks);
            const blocks = blockIds.map(id => converter.blocks[id]);

            const itemBlock = blocks.find(b => b.opcode === 'data_itemoflist');
            expect(itemBlock).toBeTruthy();

            const itemComment = converter._context.comments[itemBlock.comment];
            expect(itemComment.text).toBe('@ruby:hash:get:str');
        });
    });

    describe('$a - hash write (upsert) with symbol key', () => {
        test('$a[:name] = "Bob" generates delete+push pattern', async () => {
            const code = '$a = {name: "Alice"}\n$a[:name] = "Bob"';
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            const blockIds = Object.keys(converter.blocks);
            const blocks = blockIds.map(id => converter.blocks[id]);

            // Should have 2 delete blocks and 2 push blocks (+ literal blocks)
            const deleteBlocks = blocks.filter(b => b.opcode === 'data_deleteoflist');
            expect(deleteBlocks).toHaveLength(2);

            // First delete should have @ruby:hash:set:sym comment
            const setBlock = deleteBlocks.find(b => {
                const c = converter._context.comments[b.comment];
                return c && c.text === '@ruby:hash:set:sym';
            });
            expect(setBlock).toBeTruthy();

            // Second delete should have @ruby:hash:set:delete:key comment
            const deleteKeyBlock = deleteBlocks.find(b => {
                const c = converter._context.comments[b.comment];
                return c && c.text === '@ruby:hash:set:delete:key';
            });
            expect(deleteKeyBlock).toBeTruthy();

            // Push key and push value blocks
            const addBlocks = blocks.filter(b => b.opcode === 'data_addtolist');
            const pushKeyBlock = addBlocks.find(b => {
                const c = converter._context.comments[b.comment];
                return c && c.text === '@ruby:hash:set:push:key';
            });
            expect(pushKeyBlock).toBeTruthy();

            const pushValueBlock = addBlocks.find(b => {
                const c = converter._context.comments[b.comment];
                return c && c.text === '@ruby:hash:set:push:value';
            });
            expect(pushValueBlock).toBeTruthy();
        });

        test('$a["foo"] = "baz" generates delete+push with string key', async () => {
            const code = '$a = {"foo" => "bar"}\n$a["foo"] = "baz"';
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();

            const blockIds = Object.keys(converter.blocks);
            const blocks = blockIds.map(id => converter.blocks[id]);

            const setBlock = blocks.find(b => {
                const c = converter._context.comments[b.comment];
                return c && c.text === '@ruby:hash:set:str';
            });
            expect(setBlock).toBeTruthy();
        });
    });

    describe('@a - instance hash', () => {
        test('hash literal @a = {x: 1} generates correct list names', async () => {
            const code = '@a = {x: 1}';
            const expected = [
                {
                    opcode: 'data_deletealloflist',
                    fields: [
                        {
                            name: 'LIST',
                            list: '@_hash_a_keys_'
                        }
                    ],
                    comment: {text: '@ruby:hash:literal:1', minimized: true},
                    next: {
                        opcode: 'data_deletealloflist',
                        fields: [
                            {
                                name: 'LIST',
                                list: '@_hash_a_values_'
                            }
                        ],
                        comment: {text: '@ruby:hash:literal:values', minimized: true},
                        next: {
                            opcode: 'data_addtolist',
                            fields: [
                                {
                                    name: 'LIST',
                                    list: '@_hash_a_keys_'
                                }
                            ],
                            inputs: [
                                {
                                    name: 'ITEM',
                                    block: expectedInfo.makeText(':x')
                                }
                            ],
                            comment: {text: '@ruby:hash:literal:key:sym', minimized: true},
                            next: {
                                opcode: 'data_addtolist',
                                fields: [
                                    {
                                        name: 'LIST',
                                        list: '@_hash_a_values_'
                                    }
                                ],
                                inputs: [
                                    {
                                        name: 'ITEM',
                                        block: expectedInfo.makeText('1')
                                    }
                                ],
                                comment: {text: '@ruby:hash:literal:value', minimized: true}
                            }
                        }
                    }
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });
    });
});
