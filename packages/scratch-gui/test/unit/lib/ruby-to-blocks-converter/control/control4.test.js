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

    describe('unless (branches swapped relative to if)', () => {
        test('unless cond; A; end => control_if_else(cond, branch1=empty, branch2=A)', async () => {
            // unless cond; A; end
            // => if cond; (empty); else; A; end
            // branch[0]=null (empty then), branch[1]=A (unless-then becomes if-else)
            const code = `
                unless touching?("_edge_")
                  move(10)
                end
            `;
            const condBlock = (await rubyToExpected(converter, target, 'touching?("_edge_")'))[0];
            const moveBlock = (await rubyToExpected(converter, target, 'move(10)'))[0];
            const expected = [
                {
                    opcode: 'control_if_else',
                    inputs: [
                        {
                            name: 'CONDITION',
                            block: condBlock
                        }
                    ],
                    branches: [
                        null,
                        moveBlock
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('unless cond; A; else; B; end => control_if_else(cond, branch1=B, branch2=A)', async () => {
            // unless cond; A; else; B; end
            // => if cond; B; else; A; end
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
                            block: condBlock
                        }
                    ],
                    branches: [
                        turnBlock,
                        moveBlock
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('unless cond; else; B; end => control_if_else(cond, branch1=B, branch2=empty)', async () => {
            // unless cond; (empty); else; B; end
            // => if cond; B; else; (empty); end
            // branch[0]=B, branch[1]=null (empty else)
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
                            block: condBlock
                        }
                    ],
                    branches: [
                        turnBlock,
                        null
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('unless cond; else; end => control_if_else(cond, both branches empty)', async () => {
            // unless cond; (empty); else; (empty); end
            // => if cond; (empty); else; (empty); end
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
                            block: condBlock
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
