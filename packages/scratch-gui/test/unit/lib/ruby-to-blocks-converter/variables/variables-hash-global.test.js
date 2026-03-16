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
