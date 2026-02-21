import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    expectedInfo
} from '../../../../helpers/expect-to-equal-blocks';
import Variable from '@smalruby/scratch-vm/src/engine/variable';
import Blocks from '@smalruby/scratch-vm/src/engine/blocks';

describe('RubyToBlocksConverter/Method Return', () => {
    let converter;
    let target;

    beforeEach(() => {
        const runtime = {
            emitProjectChanged: () => {},
            getTargetForStage: () => target
        };
        target = {
            blocks: new Blocks(runtime),
            variables: {},
            lists: {},
            broadcastMsgs: {},
            comments: {},
            isStage: false,
            createVariable: function (id, name, type) {
                this.variables[id] = new Variable(id, name, type);
            },
            lookupVariableByNameAndType: function (name, type) {
                for (const varId in this.variables) {
                    const currVar = this.variables[varId];
                    if (currVar.name === name && currVar.type === type) {
                        return currVar;
                    }
                }
                return null;
            },
            createComment: function (id, blockId, text, x, y, width, height, minimized) {
                this.comments[id] = {
                    id: id,
                    blockId: blockId,
                    text: text,
                    x: x,
                    y: y,
                    width: width,
                    height: height,
                    minimized: minimized
                };
            }
        };
        const vm = {
            runtime: runtime,
            emitWorkspaceUpdate: () => {},
            extensionManager: {
                isExtensionLoaded: () => true,
                loadExtensionURL: () => Promise.resolve()
            }
        };
        converter = new RubyToBlocksConverter(vm);
        converter._context.target = target;
    });

    describe('Phase 1a: Ruby -> Block return value (basic)', () => {
        test('automatically add return variable assignment', async () => {
            const code = `
                def add(a, b)
                  a + b
                end
            `;
            const expected = [
                {
                    opcode: 'procedures_definition',
                    inputs: [
                        {
                            name: 'custom_block',
                            block: {
                                opcode: 'procedures_prototype',
                                mutation: {
                                    proccode: 'add %s %s',
                                    arguments: [
                                        {
                                            name: 'a',
                                            type: 'string_number'
                                        },
                                        {
                                            name: 'b',
                                            type: 'string_number'
                                        }
                                    ]
                                },
                                shadow: true
                            }
                        }
                    ],
                    next: {
                        opcode: 'data_setvariableto',
                        fields: [
                            {
                                name: 'VARIABLE',
                                variable: '@_return_add_'
                            }
                        ],
                        inputs: [
                            {
                                name: 'VALUE',
                                block: {
                                    opcode: 'operator_add',
                                    inputs: [
                                        {
                                            name: 'NUM1',
                                            block: {
                                                opcode: 'argument_reporter_string_number',
                                                fields: [
                                                    {
                                                        name: 'VALUE',
                                                        value: 'a'
                                                    }
                                                ]
                                            },
                                            shadow: expectedInfo.makeNumber('')
                                        },
                                        {
                                            name: 'NUM2',
                                            block: {
                                                opcode: 'argument_reporter_string_number',
                                                fields: [
                                                    {
                                                        name: 'VALUE',
                                                        value: 'b'
                                                    }
                                                ]
                                            },
                                            shadow: expectedInfo.makeNumber('')
                                        }
                                    ]
                                },
                                shadow: expectedInfo.makeText('0')
                            }
                        ],
                        comment: {
                            text: '@ruby:return:add',
                            minimized: true
                        }
                    }
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('should NOT add return variable if last block is NOT a value block', async () => {
            const code = `
                def greet(name)
                  say("Hello ")
                end
            `;
            const expected = [
                {
                    opcode: 'procedures_definition',
                    inputs: [
                        {
                            name: 'custom_block',
                            block: {
                                opcode: 'procedures_prototype',
                                mutation: {
                                    proccode: 'greet %s',
                                    arguments: [
                                        {
                                            name: 'name',
                                            type: 'string_number'
                                        }
                                    ]
                                },
                                shadow: true
                            }
                        }
                    ],
                    next: {
                        opcode: 'looks_say',
                        inputs: [
                            {
                                name: 'MESSAGE',
                                block: {
                                    opcode: 'text',
                                    fields: [
                                        {
                                            name: 'TEXT',
                                            value: 'Hello '
                                        }
                                    ],
                                    shadow: true
                                },
                                shadow: expectedInfo.makeText('Hello ')
                            }
                        ]
                    }
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('multiple statements with return value', async () => {
            const code = `
                def calculate(x)
                  say("Calculating...")
                  x * 2
                end
            `;
            const expected = [
                {
                    opcode: 'procedures_definition',
                    inputs: [
                        {
                            name: 'custom_block',
                            block: {
                                opcode: 'procedures_prototype',
                                mutation: {
                                    proccode: 'calculate %s',
                                    arguments: [
                                        {
                                            name: 'x',
                                            type: 'string_number'
                                        }
                                    ]
                                },
                                shadow: true
                            }
                        }
                    ],
                    next: {
                        opcode: 'looks_say',
                        inputs: [
                            {
                                name: 'MESSAGE',
                                block: {
                                    opcode: 'text',
                                    fields: [
                                        {
                                            name: 'TEXT',
                                            value: 'Calculating...'
                                        }
                                    ],
                                    shadow: true
                                },
                                shadow: expectedInfo.makeText('Calculating...')
                            }
                        ],
                        next: {
                            opcode: 'data_setvariableto',
                            fields: [
                                {
                                    name: 'VARIABLE',
                                    variable: '@_return_calculate_'
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
                                                    opcode: 'argument_reporter_string_number',
                                                    fields: [
                                                        {
                                                            name: 'VALUE',
                                                            value: 'x'
                                                        }
                                                    ]
                                                },
                                                shadow: expectedInfo.makeNumber('')
                                            },
                                            {
                                                name: 'NUM2',
                                                block: {
                                                    opcode: 'math_number',
                                                    fields: [
                                                        {
                                                            name: 'NUM',
                                                            value: '2'
                                                        }
                                                    ],
                                                    shadow: true
                                                }
                                            }
                                        ]
                                    },
                                    shadow: expectedInfo.makeText('0')
                                }
                            ],
                            comment: {
                                text: '@ruby:return:calculate',
                                minimized: true
                            }
                        }
                    }
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('explicit return variable assignment should NOT add @ruby:return comment', async () => {
            const code = `
                def self.add(a, b)
                  @_return_add_ = a + b
                end
            `;
            const expected = [
                {
                    opcode: 'procedures_definition',
                    inputs: [
                        {
                            name: 'custom_block',
                            block: {
                                opcode: 'procedures_prototype',
                                mutation: {
                                    proccode: 'add %s %s',
                                    arguments: [
                                        {
                                            name: 'a',
                                            type: 'string_number'
                                        },
                                        {
                                            name: 'b',
                                            type: 'string_number'
                                        }
                                    ]
                                },
                                shadow: true
                            }
                        }
                    ],
                    next: {
                        opcode: 'data_setvariableto',
                        fields: [
                            {
                                name: 'VARIABLE',
                                variable: '@_return_add_'
                            }
                        ],
                        inputs: [
                            {
                                name: 'VALUE',
                                block: {
                                    opcode: 'operator_add',
                                    inputs: [
                                        {
                                            name: 'NUM1',
                                            block: {
                                                opcode: 'argument_reporter_string_number',
                                                fields: [
                                                    {
                                                        name: 'VALUE',
                                                        value: 'a'
                                                    }
                                                ]
                                            },
                                            shadow: expectedInfo.makeNumber('')
                                        },
                                        {
                                            name: 'NUM2',
                                            block: {
                                                opcode: 'argument_reporter_string_number',
                                                fields: [
                                                    {
                                                        name: 'VALUE',
                                                        value: 'b'
                                                    }
                                                ]
                                            },
                                            shadow: expectedInfo.makeNumber('')
                                        }
                                    ]
                                },
                                shadow: expectedInfo.makeText('0')
                            }
                        ]
                        // NOTE: No comment field - this is the key assertion
                    }
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });
    });
});
