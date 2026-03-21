import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    rubyToExpected
} from '../../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/Control/unless', () => {
    let converter;
    let target;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null, {version: '2'});
        target = null;
    });

    describe('unless (negated condition, natural branch order)', () => {
        test('unless cond; A; end => control_if(not(cond), branch=A)', async () => {
            // unless cond; A; end
            // => if !(cond); A; end
            const code = `
                unless touching?("_edge_")
                  move(10)
                end
            `;
            const condBlock = (await rubyToExpected(converter, target, 'touching?("_edge_")'))[0];
            const moveBlock = (await rubyToExpected(converter, target, 'move(10)'))[0];
            const expected = [
                {
                    opcode: 'control_if',
                    inputs: [
                        {
                            name: 'CONDITION',
                            block: {
                                opcode: 'operator_not',
                                inputs: [
                                    {
                                        name: 'OPERAND',
                                        block: condBlock
                                    }
                                ]
                            }
                        }
                    ],
                    branches: [
                        moveBlock
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('unless cond; A; else; B; end => control_if_else(not(cond), branch1=A, branch2=B)', async () => {
            // unless cond; A; else; B; end
            // => if !(cond); A; else; B; end
            const code = `
                unless touching?("_edge_")
                  move(10)
                else
                  turn_right(90)
                end
            `;
            const condBlock = (await rubyToExpected(converter, target, 'touching?("_edge_")'))[0];
            const moveBlock = (await rubyToExpected(converter, target, 'move(10)'))[0];
            const turnBlock = (await rubyToExpected(converter, target, 'turn_right(90)'))[0];
            const expected = [
                {
                    opcode: 'control_if_else',
                    inputs: [
                        {
                            name: 'CONDITION',
                            block: {
                                opcode: 'operator_not',
                                inputs: [
                                    {
                                        name: 'OPERAND',
                                        block: condBlock
                                    }
                                ]
                            }
                        }
                    ],
                    branches: [
                        moveBlock,
                        turnBlock
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('unless cond; else; B; end => control_if_else(not(cond), branch1=empty, branch2=B)', async () => {
            // unless cond; (empty); else; B; end
            // => if !(cond); (empty); else; B; end
            const code = `
                unless touching?("_edge_")
                else
                  turn_right(90)
                end
            `;
            const condBlock = (await rubyToExpected(converter, target, 'touching?("_edge_")'))[0];
            const turnBlock = (await rubyToExpected(converter, target, 'turn_right(90)'))[0];
            const expected = [
                {
                    opcode: 'control_if_else',
                    inputs: [
                        {
                            name: 'CONDITION',
                            block: {
                                opcode: 'operator_not',
                                inputs: [
                                    {
                                        name: 'OPERAND',
                                        block: condBlock
                                    }
                                ]
                            }
                        }
                    ],
                    branches: [
                        null,
                        turnBlock
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('unless cond; else; end => control_if_else(not(cond), both branches empty)', async () => {
            // unless cond; (empty); else; (empty); end
            // => if !(cond); (empty); else; (empty); end
            const code = `
                unless touching?("_edge_")
                else
                end
            `;
            const condBlock = (await rubyToExpected(converter, target, 'touching?("_edge_")'))[0];
            const expected = [
                {
                    opcode: 'control_if_else',
                    inputs: [
                        {
                            name: 'CONDITION',
                            block: {
                                opcode: 'operator_not',
                                inputs: [
                                    {
                                        name: 'OPERAND',
                                        block: condBlock
                                    }
                                ]
                            }
                        }
                    ],
                    branches: [
                        null,
                        null
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });
    });

    describe('if !variable (not operator on variable)', () => {
        test('if !$global; A; end => control_if(not(variable), branch=A)', async () => {
            const code = `
                if !$global
                  move(10)
                end
            `;
            const moveBlock = (await rubyToExpected(converter, target, 'move(10)'))[0];
            const expected = [
                {
                    opcode: 'control_if',
                    inputs: [
                        {
                            name: 'CONDITION',
                            block: {
                                opcode: 'operator_not',
                                inputs: [
                                    {
                                        name: 'OPERAND',
                                        block: {
                                            opcode: 'data_variable',
                                            fields: [
                                                {
                                                    name: 'VARIABLE',
                                                    variable: '$global'
                                                }
                                            ]
                                        }
                                    }
                                ]
                            }
                        }
                    ],
                    branches: [
                        moveBlock
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('if !@ivar; A; end => control_if(not(variable), branch=A)', async () => {
            const code = `
                if !@ivar
                  move(10)
                end
            `;
            const moveBlock = (await rubyToExpected(converter, target, 'move(10)'))[0];
            const expected = [
                {
                    opcode: 'control_if',
                    inputs: [
                        {
                            name: 'CONDITION',
                            block: {
                                opcode: 'operator_not',
                                inputs: [
                                    {
                                        name: 'OPERAND',
                                        block: {
                                            opcode: 'data_variable',
                                            fields: [
                                                {
                                                    name: 'VARIABLE',
                                                    variable: '@ivar'
                                                }
                                            ]
                                        }
                                    }
                                ]
                            }
                        }
                    ],
                    branches: [
                        moveBlock
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('if !local_var; A; end => control_if(not(variable), branch=A)', async () => {
            const code = `
                bool = true
                if !bool
                  say("ok")
                end
            `;
            const assignBlock = (await rubyToExpected(converter, target, 'bool = true'))[0];
            const sayBlock = (await rubyToExpected(converter, target, 'say("ok")'))[0];
            const expected = [
                {
                    ...assignBlock,
                    next: {
                        opcode: 'control_if',
                        inputs: [
                            {
                                name: 'CONDITION',
                                block: {
                                    opcode: 'operator_not',
                                    inputs: [
                                        {
                                            name: 'OPERAND',
                                            block: {
                                                opcode: 'data_variable',
                                                fields: [
                                                    {
                                                        name: 'VARIABLE',
                                                        variable: '_bool_1_'
                                                    }
                                                ]
                                            }
                                        }
                                    ]
                                }
                            }
                        ],
                        branches: [
                            sayBlock
                        ]
                    }
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });
    });
});
