import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    rubyToExpected,
    expectedInfo
} from '../../../helpers/expect-to-equal-blocks';
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
            isStage: false,
            createVariable: function (id, name, type) {
                this.variables[id] = new Variable(id, name, type);
            }
        };
        const vm = {
            runtime: runtime,
            emitWorkspaceUpdate: () => {}
        };
        converter = new RubyToBlocksConverter(vm);
        converter._context.target = target;
    });

    describe('Phase 0: def foo support', () => {
        test('procedures_definition with def foo (no receiver)', () => {
            const code = `
                def made_block(arg1)
                  move(arg1)
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
                                    proccode: 'made_block %s',
                                    arguments: [
                                        {
                                            name: 'arg1',
                                            type: 'string_number'
                                        }
                                    ]
                                },
                                shadow: true
                            }
                        }
                    ],
                    next: {
                        opcode: 'motion_movesteps',
                        inputs: [
                            {
                                name: 'STEPS',
                                block: {
                                    opcode: 'argument_reporter_string_number',
                                    fields: [
                                        {
                                            name: 'VALUE',
                                            value: 'arg1'
                                        }
                                    ]
                                },
                                shadow: expectedInfo.makeNumber(10)
                            }
                        ]
                    }
                }
            ];
            convertAndExpectToEqualBlocks(converter, target, code, expected);
        });
    });

    describe('Phase 1: Ruby -> Block return value', () => {
        test('automatically add return variable assignment', () => {
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
                                variable: '@_return_add'
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
            convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('should NOT add return variable if last block is NOT a value block', () => {
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
            convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('multiple statements with return value', () => {
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
                                    variable: '@_return_calculate'
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
            convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('explicit return variable assignment should NOT add @ruby:return comment', () => {
            const code = `
                def self.add(a, b)
                  @_return_add = a + b
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
                                variable: '@_return_add'
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
            convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('should NOT add @ruby:return comment to procedures_call when NOT used as a value', () => {
            const code = `
                def add(a, b)
                  a + b
                end
                
                when_flag_clicked do
                  add(1, 5)
                end
            `;
            const result = converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);
            
            // Find the procedures_call block
            const proceduresCall = Object.values(converter.blocks).find(b => b.opcode === 'procedures_call');
            expect(proceduresCall).toBeDefined();
            expect(proceduresCall.comment).toBeUndefined();
        });

        test('should add @ruby:return comment to procedures_call when used as a value', () => {
            const code = `
                def add(a, b)
                  a + b
                end
                
                when_flag_clicked do
                  say(add(1, 5))
                end
            `;
            const result = converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);
            
            // Find the procedures_call block
            const proceduresCall = Object.values(converter.blocks).find(b => b.opcode === 'procedures_call');
            expect(proceduresCall).toBeDefined();
            expect(proceduresCall.comment).toBeDefined();
            const comment = converter._context.comments[proceduresCall.comment];
            expect(comment.text).toBe('@ruby:return:add');
        });

        test('top-level method call with return value should create procedures_call + data_variable', () => {
            const code = `
                def add(a, b)
                  a + b
                end

                say(add(1, 5))
            `;
            const result = converter.targetCodeToBlocks(target, code);
            expect(result).toBe(true);

            // Should have a procedures_call block with @ruby:return comment
            const proceduresCall = Object.values(converter.blocks).find(b => b.opcode === 'procedures_call');
            expect(proceduresCall).toBeDefined();
            expect(proceduresCall.comment).toBeDefined();
            const callComment = converter._context.comments[proceduresCall.comment];
            expect(callComment.text).toBe('@ruby:return:add');

            // The value input of say should be a data_variable block with @ruby:return:add comment
            const sayBlock = Object.values(converter.blocks).find(b => b.opcode === 'looks_say');
            expect(sayBlock).toBeDefined();
            const valueBlockId = sayBlock.inputs.MESSAGE.block;
            const valueBlock = converter.blocks[valueBlockId];
            expect(valueBlock.opcode).toBe('data_variable');
            expect(valueBlock.comment).toBeDefined();
            const varComment = converter._context.comments[valueBlock.comment];
            expect(varComment.text).toBe('@ruby:return:add');

            // procedures_call should come before say in the block chain
            expect(proceduresCall.next).toBe(sayBlock.id);
            expect(sayBlock.parent).toBe(proceduresCall.id);
        });

    });
});
