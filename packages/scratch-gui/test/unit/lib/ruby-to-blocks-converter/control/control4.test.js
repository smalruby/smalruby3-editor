import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    rubyToExpected
} from '../../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/Control/unless', () => {
    let converter;
    let target;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null);
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
});
