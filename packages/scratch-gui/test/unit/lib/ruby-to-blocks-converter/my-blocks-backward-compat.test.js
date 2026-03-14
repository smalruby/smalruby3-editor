import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    expectedInfo
} from '../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/My Blocks backward compatibility (def self.method in v2 mode)', () => {
    let converter;
    let target;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null, {version: '2'});
        target = null;
    });

    test('def self.method_name is accepted', async () => {
        const code = `
            def self.made_block
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
                                proccode: 'made_block',
                                arguments: []
                            },
                            shadow: true
                        }
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('def self.method_name with arguments is accepted', async () => {
        const code = `
            def self.made_block(arg1, arg2)
              move(10)
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
                                proccode: 'made_block %s %s',
                                arguments: [
                                    {
                                        name: 'arg1',
                                        type: 'string_number'
                                    },
                                    {
                                        name: 'arg2',
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
                            block: expectedInfo.makeNumber(10)
                        }
                    ]
                }
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });
});
