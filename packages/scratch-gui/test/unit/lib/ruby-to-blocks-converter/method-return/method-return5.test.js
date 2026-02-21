import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    convertAndExpectRubyBlockError,
    rubyToExpected,
    expectedInfo
} from '../../../../helpers/expect-to-equal-blocks';
import Variable from '@smalruby/scratch-vm/src/engine/variable';
import Blocks from '@smalruby/scratch-vm/src/engine/blocks';

describe('RubyToBlocksConverter/Method Return Bug Fixes', () => {
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
            editingTarget: target
        };
        converter = new RubyToBlocksConverter(vm);
    });

    describe('Case 1: Error detection for non-trailing value block in method body', () => {
        test('should throw error when non-trailing value block exists', async () => {
            const code = `
                def add(a, b)
                  a + b
                  return 0
                end

                say(add(1, 5), 2)
            `;
            await convertAndExpectRubyBlockError(converter, target, code);
        });
    });

    describe('Case 2: Trailing literals in method body', () => {
        test('integer literal', async () => {
            const code = `
                def one
                  1
                end

                say(one, 1)
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
                                    proccode: 'one',
                                    argumentids: '[]',
                                    argumentnames: '[]',
                                    argumentdefaults: '[]'
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
                                variable: '@_return_one_'
                            }
                        ],
                        inputs: [
                            {
                                name: 'VALUE',
                                block: expectedInfo.makeNumber(1)
                            }
                        ],
                        comment: {
                            text: '@ruby:return:one',
                            minimized: true
                        }
                    }
                },
                {
                    opcode: 'procedures_call',
                    mutation: {
                        proccode: 'one',
                        argumentids: '[]',
                        warp: 'false'
                    },
                    next: {
                        opcode: 'looks_sayforsecs',
                        inputs: [
                            {
                                name: 'MESSAGE',
                                block: {
                                    opcode: 'data_variable',
                                    fields: [
                                        {
                                            name: 'VARIABLE',
                                            variable: '@_return_one_'
                                        }
                                    ]
                                },
                                shadow: expectedInfo.makeText('Hello!')
                            },
                            {
                                name: 'SECS',
                                block: {
                                    opcode: 'math_number',
                                    fields: [
                                        {
                                            name: 'NUM',
                                            value: '1'
                                        }
                                    ],
                                    shadow: true
                                }
                            }
                        ]
                    }
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('boolean literal (true)', async () => {
            const code = `
                def is_true
                  true
                end

                say(is_true, 1)
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
                                    proccode: 'is_true',
                                    argumentids: '[]',
                                    argumentnames: '[]',
                                    argumentdefaults: '[]'
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
                                variable: '@_return_is_true_'
                            }
                        ],
                        inputs: [
                            {
                                name: 'VALUE',
                                block: expectedInfo.makeText('true')
                            }
                        ],
                        comment: {
                            text: '@ruby:return:is_true',
                            minimized: true
                        }
                    }
                },
                {
                    opcode: 'procedures_call',
                    mutation: {
                        proccode: 'is_true',
                        argumentids: '[]',
                        warp: 'false'
                    },
                    next: {
                        opcode: 'looks_sayforsecs',
                        inputs: [
                            {
                                name: 'MESSAGE',
                                block: {
                                    opcode: 'data_variable',
                                    fields: [
                                        {
                                            name: 'VARIABLE',
                                            variable: '@_return_is_true_'
                                        }
                                    ]
                                },
                                shadow: expectedInfo.makeText('Hello!')
                            },
                            {
                                name: 'SECS',
                                block: {
                                    opcode: 'math_number',
                                    fields: [
                                        {
                                            name: 'NUM',
                                            value: '1'
                                        }
                                    ],
                                    shadow: true
                                }
                            }
                        ]
                    }
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('string literal', async () => {
            const code = `
                def greeting
                  "ハロー！"
                end

                say(greeting, 1)
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
                                    proccode: 'greeting',
                                    argumentids: '[]',
                                    argumentnames: '[]',
                                    argumentdefaults: '[]'
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
                                variable: '@_return_greeting_'
                            }
                        ],
                        inputs: [
                            {
                                name: 'VALUE',
                                block: expectedInfo.makeText('ハロー！')
                            }
                        ],
                        comment: {
                            text: '@ruby:return:greeting',
                            minimized: true
                        }
                    }
                },
                {
                    opcode: 'procedures_call',
                    mutation: {
                        proccode: 'greeting',
                        argumentids: '[]',
                        warp: 'false'
                    },
                    next: {
                        opcode: 'looks_sayforsecs',
                        inputs: [
                            {
                                name: 'MESSAGE',
                                block: {
                                    opcode: 'data_variable',
                                    fields: [
                                        {
                                            name: 'VARIABLE',
                                            variable: '@_return_greeting_'
                                        }
                                    ]
                                },
                                shadow: expectedInfo.makeText('Hello!')
                            },
                            {
                                name: 'SECS',
                                block: {
                                    opcode: 'math_number',
                                    fields: [
                                        {
                                            name: 'NUM',
                                            value: '1'
                                        }
                                    ],
                                    shadow: true
                                }
                            }
                        ]
                    }
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });
    });
});
