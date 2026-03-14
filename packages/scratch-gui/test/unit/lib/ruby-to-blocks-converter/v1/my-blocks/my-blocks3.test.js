import RubyToBlocksConverter from '../../../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    rubyToExpected,
    expectedInfo
} from '../../../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/My Blocks (v1)', () => {
    let converter;
    let target;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null, {version: '1'});
        target = null;
    });

    test('procedures_call 2', async () => {
        const code = `
            def self.made_block(arg1)
            end

            made_block(12)
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
                ]
            },
            {
                opcode: 'procedures_call',
                mutation: {
                    proccode: 'made_block %s',
                    argument_blocks: [
                        expectedInfo.makeText('12')
                    ]
                }
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('procedures_call recursive', async () => {
        const code = `
            def self.made_block(arg1)
              made_block(arg1 - 1)
            end

            made_block(12)
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
                    opcode: 'procedures_call',
                    mutation: {
                        proccode: 'made_block %s',
                        argument_blocks: [
                            {
                                opcode: 'operator_subtract',
                                inputs: [
                                    {
                                        name: 'NUM1',
                                        block: {
                                            opcode: 'argument_reporter_string_number',
                                            fields: [
                                                {
                                                    name: 'VALUE',
                                                    value: 'arg1'
                                                }
                                            ]
                                        },
                                        shadow: expectedInfo.makeNumber('')
                                    },
                                    {
                                        name: 'NUM2',
                                        block: expectedInfo.makeNumber(1)
                                    }
                                ]
                            }
                        ]
                    }
                }
            },
            {
                opcode: 'procedures_call',
                mutation: {
                    proccode: 'made_block %s',
                    argument_blocks: [
                        expectedInfo.makeText('12')
                    ]
                }
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    describe('error if argument type miss match', () => {
        test('defined string_number, call boolean', async () => {
            const code = `
                def self.made_block(arg1, arg2)
                  if arg2
                  end
                end

                made_block(12, 34)
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(1);
            expect(converter.errors[0].text).toMatch(/invalid type of My Block "made_block" argument #2/);
            expect(res).toBeFalsy();
        });

        test('defined boolean, call string_number', async () => {
            const code = `
                def self.made_block(arg1, arg2)
                end

                made_block(:symbol, 1)
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(1);
            expect(converter.errors[0].text).toMatch(/invalid type of My Block "made_block" argument #1/);
            expect(res).toBeFalsy();
        });
    });
});
